let video;
let handPose;
let hands = [];

let stage = 0; // 0: 封面, 1: 輸入姓名, 2: 第一關說明, 3: 第一關遊玩, 4: 第二關說明, 5: 第二關遊玩, 6: 第三關說明, 7: 第三關遊玩, 8: 遊戲結束
let score = 0;

// -------- 第一關 --------
let gestures = ["👌", "✋", "👍", "✌"];
let currentGesture = "";
let completedGestures = new Set(); // 新增：用來追蹤玩家已完成哪些手勢
let showSuccess = false;
let successTime = 0;

// -------- 手勢保持進度條 --------
let holdingCorrectGesture = false;

// -------- 第二關 --------
let targets = [];
let showTargets = true;
let showCountdown = false;
let countdown = 3;
let startTime = 0;
let displayedTargets = []; // 新增：用於顯示問號或已完成的手勢
let roundIndex = 0;        // 當前題目中比到第幾個手勢
let currentTarget = "";    // 當前目標手勢
let playStartTime = 0;   // 答題開始時間
let playLimit = 15000;   // 每題 (三個手勢) 限制時間 (毫秒)
let holdStartTime = 0;   // 開始保持手勢的時間
const holdDuration = 800; // 保持手勢的持續時間 (毫秒)
let problemWon = false;  // 當前題目是否成功

let starEffect = { active: false, startTime: 0, duration: 600 }; // 星星特效狀態
let perfectEffect = { active: false, startTime: 0, duration: 800, x: 0, y: 0, points: 0 }; // Perfect 文字特效
let missEffect = { active: false, startTime: 0, duration: 800, x: 0, y: 0, points: 0 }; // Miss 文字特效

let gameOver = false; // 遊戲是否結束
let finalScore = 0; // 最終分數
let finalRating = ""; // 最終評價
let leaderboard = []; // 分數排行榜
let nameInput;       // 姓名輸入框
let submitBtn;       // 送出按鈕
let randomBtn;       // 隨機姓名按鈕
let scoreSaved = false; // 是否已儲存分數
let playerName = "";   // 儲存玩家姓名
let currentDetectedGestures = []; // 修改：儲存目前所有偵測到的手勢
let cameraErrorMessage = ""; // 儲存攝影機錯誤訊息
let cameraLoaded = false;  // 攝影機是否已成功連線
let cameraTimeoutTimer;    // 逾時計時器
let confetti = [];         // 彩色紙屑粒子陣列
let isNewHighScore = false; // 是否打破最高紀錄

// -------- 第三關 --------
let items = [];
let collected = 0;
let combo = 0; // 連擊計數器
let noteSpeed = 3; // 音符掉落速度
let currentSubStage = 1; // 1: 基礎, 2: 進階
let stage3Score = 0;    // 第三關專用得分

let problemCount = 0;    // 已挑戰的題目數量
let bgParticles = []; // 背景裝飾粒子
let flashRed = 0; // 答錯時的紅光閃爍強度
let hueOffset = 0; // 用於漸層背景動畫的色相偏移值

// 手指連線路徑群組
const FINGER_PARTS = [
  [0, 1, 2, 3, 4],     // 大拇指
  [5, 6, 7, 8],        // 食指
  [9, 10, 11, 12],     // 中指
  [13, 14, 15, 16],    // 無名指
  [17, 18, 19, 20]     // 小拇指
];

function preload() {
  // 優化模型設定：偵測最多 2 隻手，以支援第三關雙手操作
  handPose = ml5.handPose({ 
    flipped: true, 
    maxHands: 2 
  });
}

function setup() {
  createCanvas(windowWidth, windowHeight);

  // 使用更健全的 constraints 設定
  const constraints = {
    video: {
      facingMode: "user",
      width: 640,
      height: 480
    },
    audio: false
  };

  // 使用 try-catch 配合 p5 的回呼來捕捉啟動錯誤
  try {
    video = createCapture(constraints, function(stream) {
      console.log("攝影機串流已成功建立");
      cameraLoaded = true;
      clearTimeout(cameraTimeoutTimer);
      video.elt.setAttribute('playsinline', ''); // iOS 必備
      video.play(); 
      handPose.detectStart(video, gotHands);
    });
  } catch (err) {
    console.error("無法呼叫 createCapture:", err);
    cameraErrorMessage = err.name || "啟動失敗";
  }

  // 監聽影片物件本身的錯誤
  video.elt.addEventListener('error', (event) => {
    console.error("攝影機物件發生錯誤:", event);
    cameraErrorMessage = "硬體錯誤 (AbortError)";
  });

  // 設定一個 10 秒的逾時檢查，如果玩家太久沒點「允許」或硬體沒回應，就報錯
  cameraTimeoutTimer = setTimeout(() => {
    if (!cameraLoaded) {
      console.warn("攝影機啟動逾時");
      cameraErrorMessage = "啟動逾時 (Timeout)";
    }
  }, 10000);

  video.hide();

  textAlign(CENTER, CENTER);
  
  // 設定畫布全域字體為 Google Fonts 提供的俏皮「快樂體」
  textFont('ZCOOL KuaiLe');

  // 初始化背景粒子
  for (let i = 0; i < 60; i++) {
    bgParticles.push({
      x: random(width), y: random(height),
      vx: random(-0.6, 0.6), vy: random(-0.6, 0.6),
      size: random(1, 4),
      c: color(random(150, 255), random(150, 255), 255, 120)
    });
  }

  // 從瀏覽器讀取本地排行榜
  let savedLeaderboard = localStorage.getItem('gestureGameLeaderboard');
  if (savedLeaderboard) {
    try {
      leaderboard = JSON.parse(savedLeaderboard);
      // 相容性處理：如果舊資料是純數字陣列，轉換為物件格式
      if (leaderboard.length > 0 && typeof leaderboard[0] === 'number') {
        leaderboard = leaderboard.map(s => ({ name: "未知玩家", score: s }));
      }
    } catch (e) {
      leaderboard = [];
    }
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

// ================= DRAW =================
function draw() {
  // 背景美化：深色濾鏡效果
  background(15);

  // 若攝影機發生錯誤（例如權限被拒、逾時、或非 HTTPS 環境）
  if (cameraErrorMessage !== "") {
    fill(255, 50, 50);
    textSize(24);
    text("⚠️ 攝影機啟動失敗: " + cameraErrorMessage, width / 2, height / 2 - 40);
    textSize(18);
    fill(200);
    text("1. 請關閉其他可能在使用攝影機的程式 (Zoom, Meet, Line)\n2. 重新整理頁面並確保點擊了「允許」\n3. 檢查 Windows 隱私設定是否允許瀏覽器開啟攝影機", width / 2, height / 2 + 50);
    return; // 報錯時停止執行後續繪圖邏輯
  }

  tint(255, 130); 
  // 檢查影片是否已經有資料可以顯示，避免在載入中顯示黑畫面
  if (video && video.elt && video.elt.readyState >= 2) {
    // 修正鏡像問題：將畫布水平翻轉後繪製攝影機畫面
    push();
    translate(width, 0);
    scale(-1, 1);
    image(video, 0, 0, width, height);
    pop();
  } else {
    fill(255);
    textSize(24);
    text("攝影機啟動中，請確保已允許使用權限...", width/2, height/2);
  }
  noTint();

  // 繪製動態粒子
  noStroke();
  for (let p of bgParticles) {
    p.x = (p.x + p.vx + width) % width;
    p.y = (p.y + p.vy + height) % height;
    fill(p.c);
    ellipse(p.x, p.y, p.size);
  }

  // 統一在此處繪製一次手部骨架即可
  if (video && video.elt && video.elt.readyState >= 2) {
    drawHand();
  }

  if (stage === 0) drawCoverScreen();
  if (stage === 1) drawNameInputScreen(); // 新增：姓名輸入頁面
  if (stage === 2) drawStage1Intro(); 
  if (stage === 3) drawStage1();     
  if (stage === 4) drawStage2Intro(); 
  if (stage === 5) drawStage2();     
  if (stage === 6) drawStage3Intro(); 
  if (stage === 7) drawStage3();     
  if (stage === 8) drawGameOver();   

  // 繪製紅光閃爍處罰效果 (放在 UI 之前，確保不會遮擋 UI 文字太久)
  if (flashRed > 0) {
    push();
    rectMode(CORNER);
    noStroke();
    fill(255, 0, 0, flashRed);
    rect(0, 0, width, height);
    pop();
    flashRed = max(0, flashRed - 10); // 逐漸淡出
  }

  // --- 繪製 Perfect 文字特效 (全域) ---
  if (perfectEffect.active) {
    let elapsed = millis() - perfectEffect.startTime;
    if (elapsed < perfectEffect.duration) {
      let progress = elapsed / perfectEffect.duration;
      let alpha = map(progress, 0.6, 1, 255, 0, true);
      let yOffset = progress * -60;
      push();
      textAlign(CENTER, CENTER);
      textSize(45);
      fill(255, 255, 0, alpha);
      drawingContext.shadowBlur = 25;
      drawingContext.shadowColor = color(255, 255, 0);
      text("Perfect! +" + perfectEffect.points, perfectEffect.x, perfectEffect.y + yOffset);
      pop();
    } else {
      perfectEffect.active = false;
    }
  }

  // --- 繪製 Miss 文字特效 (全域) ---
  if (missEffect.active) {
    let elapsed = millis() - missEffect.startTime;
    if (elapsed < missEffect.duration) {
      let progress = elapsed / missEffect.duration;
      let alpha = map(progress, 0.6, 1, 255, 0, true);
      let yOffset = progress * -60;
      push();
      textAlign(CENTER, CENTER);
      textSize(45);
      fill(255, 0, 0, alpha);
      drawingContext.shadowBlur = 25;
      drawingContext.shadowColor = color(255, 0, 0);
      text("Miss! -" + missEffect.points, missEffect.x, missEffect.y + yOffset);
      pop();
    } else {
      missEffect.active = false;
    }
  }

  drawUI();

  // --- 按鈕漸層背景動畫 ---
  hueOffset = (hueOffset + 0.5) % 360; // 每幀增加 0.5 度色相，並在 360 度時循環

  if (submitBtn) {
    // 進入遊戲按鈕的漸層色相動畫
    let submitHue1 = (180 + hueOffset) % 360; // 初始青藍色 (約 180 度)
    let submitHue2 = (209 + hueOffset) % 360; // 初始藍色 (約 209 度)
    submitBtn.style('background', `linear-gradient(135deg, hsl(${submitHue1}, 100%, 50%) 0%, hsl(${submitHue2}, 99%, 65%) 100%)`);
    // 陰影顏色可以保持固定，或根據其中一個色相調整
    // submitBtn.style('box-shadow', `0 6px 20px hsla(${submitHue2}, 99%, 45%, 0.5)`);
  }

  if (randomBtn) {
    // 隨機姓名按鈕的漸層色相動畫
    let randomHue1 = (358 + hueOffset) % 360; // 初始粉紅色 (約 358 度)
    let randomHue2 = (16 + hueOffset) % 360;  // 初始橘色 (約 16 度)
    randomBtn.style('background', `linear-gradient(135deg, hsl(${randomHue1}, 100%, 80%) 0%, hsl(${randomHue2}, 75%, 88%) 100%)`);
    // 陰影顏色可以保持固定，或根據其中一個色相調整
    // randomBtn.style('box-shadow', `0 6px 20px hsla(${randomHue2}, 75%, 78%, 0.5)`);
  }

}

// ================= HAND =================
function gotHands(results) {
  hands = results;
  // 將所有偵測到的手部模型結果轉換為手勢字串並儲存於陣列
  currentDetectedGestures = hands.map(h => recognizeGesture(h));
}

function getGesture() {
  return currentDetectedGestures;
}

// 手勢辨識邏輯
function recognizeGesture(hand) {
  // 取得關鍵點 (Tip: 4, 8, 12, 16, 20 | MCP: 2, 5, 9, 13, 17)
  let k = hand.keypoints;
  let wrist = k[0];

  // 判斷手指是否伸直：指尖到手腕的距離 vs 指根(MCP)到手腕的距離
  // 倍率設為 1.15 代表指尖必須比指根遠 15% 才算伸直
  const isUp = (tipIdx, mcpIdx) => dist(k[tipIdx].x, k[tipIdx].y, wrist.x, wrist.y) > dist(k[mcpIdx].x, k[mcpIdx].y, wrist.x, wrist.y) * 1.15;

  let thumbUp = isUp(4, 2);
  let indexUp = isUp(8, 5);
  let middleUp = isUp(12, 9);
  let ringUp = isUp(16, 13);
  let pinkyUp = isUp(20, 17);

  // --- 手勢判斷邏輯 (優化順序與靈敏度) ---
  
  // 1. 布：四指都伸直
  if (indexUp && middleUp && ringUp && pinkyUp) return "✋";
  
  // 2. 剪刀：食指中指伸直，無名指小指收起
  if (indexUp && middleUp && !ringUp && !pinkyUp) return "✌";
  
  // 3. 讚：只有大拇指伸直，且食指、中指、無名指都收起
  if (thumbUp && !indexUp && !middleUp && !ringUp && !pinkyUp) return "👍";
  
  // 偵測距離 (供 OK 與 pinch 使用)
  let d = dist(k[8].x, k[8].y, k[4].x, k[4].y);

  // 4. OK：食指與大拇指尖靠近，且其他三指(中、無名、小指)伸直
  if (d < 60 && middleUp && ringUp && pinkyUp) return "👌";
  
  // 偵測一般捏合 (供第三關使用)
  if (d < 60) return "pinch";
  
  return "未定義";
}

function drawHand() {
  for (let hand of hands) {
    // 設定發光效果與顏色 (左手洋紅，右手黃色)
    let col = hand.handedness === "Left" ? color(255, 0, 255) : color(255, 255, 0);
    stroke(col);
    strokeWeight(4);
    noFill();

    // 繪製手指連線
    for (let part of FINGER_PARTS) {
      for (let i = 0; i < part.length - 1; i++) {
        let p1 = hand.keypoints[part[i]];
        let p2 = hand.keypoints[part[i + 1]];
        
        // 動態映射：將座標從影片原始大小映射到畫布大小，確保骨架精準對齊
        let x1 = map(p1.x, 0, video.width, 0, width);
        let y1 = map(p1.y, 0, video.height, 0, height);
        let x2 = map(p2.x, 0, video.width, 0, width);
        let y2 = map(p2.y, 0, video.height, 0, height);
        line(x1, y1, x2, y2);
      }
    }
    
    // 額外連接指根到手腕 (0號點) 讓骨架更完整
    let wrist = hand.keypoints[0];
    for (let baseIdx of [5, 9, 13, 17]) {
      let b = hand.keypoints[baseIdx];
      line(
        map(wrist.x, 0, video.width, 0, width), map(wrist.y, 0, video.height, 0, height),
        map(b.x, 0, video.width, 0, width), map(b.y, 0, video.height, 0, height)
      );
    }
  }
}

// ================= COVER SCREEN =================
function drawCoverScreen() {
  // 背景半透明遮罩
  fill(10, 10, 25, 180);
  rect(0, 0, width, height);
  
  // --- 1. 背景裝飾：漂浮的手勢符號 ---
  push();
  for (let i = 0; i < 10; i++) {
    // 使用 noise 產生平滑且隨機的運動軌跡
    let nx = noise(i * 15, frameCount * 0.003) * width * 1.4 - width * 0.2;
    let ny = noise(i * 15 + 100, frameCount * 0.003) * height * 1.4 - height * 0.2;
    let rot = frameCount * 0.008 + i * 2;
    let g = gestures[i % gestures.length];
    let s = 30 + noise(i * 10, frameCount * 0.005) * 40;
    
    push();
    translate(nx, ny);
    rotate(rot);
    textSize(s);
    fill(0, 255, 255, 30); // 淡淡的青色裝飾
    text(g, 0, 0);
    pop();
  }
  pop();

  // --- 2. 主標題發光動態 ---
  let glowSize = map(sin(frameCount * 0.1), -1, 1, 20, 50);
  // 顏色隨 hueOffset 變化，產生彩虹發光效果
  push();
  colorMode(HSB, 360, 100, 100, 255);
  let titleGlow = color(hueOffset, 80, 100);
  pop();
  
  drawingContext.shadowBlur = glowSize;
  drawingContext.shadowColor = titleGlow;
  fill(255);
  textSize(100);
  text("手勢挑戰大冒險", width / 2, height / 2 - 80);
  
  // --- 3. 副標題 ---
  drawingContext.shadowBlur = 10;
  drawingContext.shadowColor = color(255);
  textSize(30);
  fill(200, 255, 255);
  text("用 雙 手 掌 控 節 奏 與 記 憶", width / 2, height / 2 + 10);

  // --- 4. 開始提示 ---
  drawingContext.shadowBlur = 15;
  drawingContext.shadowColor = color(255, 100, 255);
  let startAlpha = map(sin(frameCount * 0.08), -1, 1, 100, 255);
  fill(255, 150, 255, startAlpha);
  textSize(32);
  text("按下 [ 空白鍵 ] 或 [ 點擊 ] 開始", width / 2, height / 2 + 120);
  drawingContext.shadowBlur = 0;
}

// ================= NAME INPUT SCREEN =================
function setupNameInput() {
  if (nameInput) nameInput.remove();
  if (submitBtn) submitBtn.remove();
  if (randomBtn) randomBtn.remove();

  nameInput = createInput("");
  nameInput.attribute("placeholder", "輸入你的姓名...");
  nameInput.attribute("maxlength", "10");
  nameInput.size(240, 40);
  nameInput.style('font-family', 'ZCOOL KuaiLe');
  nameInput.style('font-size', '18px');
  // 優化輸入框樣式
  nameInput.style('border', '2px solid #4facfe');
  nameInput.style('border-radius', '10px');
  nameInput.style('padding-left', '10px');
  nameInput.style('outline', 'none');
  
  submitBtn = createButton("進入遊戲");
  submitBtn.size(200, 60);
  submitBtn.style('font-family', 'ZCOOL KuaiLe');
  submitBtn.style('font-size', '24px');
  // 套用彩色漸層背景與美化樣式 (青藍色調)
  submitBtn.style('background', 'linear-gradient(135deg, #00f2fe 0%, #4facfe 100%)');
  submitBtn.style('color', 'white');
  submitBtn.style('border', 'none');
  submitBtn.style('border-radius', '30px');
  submitBtn.style('cursor', 'pointer');
  submitBtn.style('box-shadow', '0 6px 20px rgba(79, 172, 254, 0.5)');
  submitBtn.mousePressed(() => {
    playerName = nameInput.value() || "匿名玩家";
    removeNameUI();
    stage = 2; // 進入第一關說明
  });

  randomBtn = createButton("隨機姓名");
  randomBtn.size(130, 40);
  randomBtn.style('font-family', 'ZCOOL KuaiLe');
  randomBtn.style('font-size', '18px');
  // 套用彩色漸層背景與美化樣式 (粉橘色調)
  randomBtn.style('background', 'linear-gradient(135deg, #ff9a9e 0%, #fad0c4 100%)');
  randomBtn.style('color', '#555');
  randomBtn.style('border', 'none');
  randomBtn.style('border-radius', '20px');
  randomBtn.style('cursor', 'pointer');
  randomBtn.mousePressed(() => {
    const animals = [
      "小貓", "小狗", "兔子", "倉鼠", "熊貓", "狐狸", "企鵝", "海豚", "無尾熊", 
      "獅子", "貓頭鷹", "小鹿", "老虎", "大象", "長頸鹿", "斑馬", "袋鼠", 
      "樹懶", "刺蝟", "松鼠", "浣熊", "老鷹", "鸚鵡", "蜂鳥", "火烈鳥", 
      "鯨魚", "鯊魚", "章魚", "水母", "海龜", "海星", "獨角獸", "恐龍", 
      "噴火龍", "草泥馬", "土撥鼠", "水豚", "鴨嘴獸"
    ];
    let randomAnimal = random(animals);
    nameInput.value("匿名" + randomAnimal);
  });
}

// 統一清理姓名輸入相關 UI
function removeNameUI() {
  if (nameInput) nameInput.remove();
  if (submitBtn) submitBtn.remove();
  if (randomBtn) randomBtn.remove();
  nameInput = null;
  submitBtn = null;
  randomBtn = null;
}

function drawNameInputScreen() {
  fill(20, 20, 40, 240);
  rect(0, 0, width, height);

  // 增加字體的發光效果
  drawingContext.shadowBlur = 20;
  drawingContext.shadowColor = color(0, 255, 255);
  fill(255);
  textSize(50);
  text("請輸入姓名或暱稱", width / 2, height / 2 - 100);
  drawingContext.shadowBlur = 0;
  
  if (nameInput && submitBtn && randomBtn) {
    nameInput.position(width / 2 - 200, height / 2);
    randomBtn.position(width / 2 + 70, height / 2); // 移到輸入框右側
    submitBtn.position(width / 2 - 100, height / 2 + 80); // 移到下方並水平居中
  }
}

function drawStage1Intro() {
  fill(20, 20, 40, 240);
  rect(0, 0, width, height);
  fill(255);
  textSize(50);
  text("歡迎，" + playerName + "！", width / 2, height / 2 - 150);
  textSize(40);
  text("第一關：手勢模仿", width / 2, height / 2 - 80);
  text("👌 OK | ✋ 布 | 👍 讚 | ✌ 剪刀", width / 2, height / 2 + 70);
  
  let alpha = map(sin(frameCount * 0.1), -1, 1, 100, 255);
  fill(0, 255, 200, alpha);
  textSize(30);
  text("按下 [ 空白鍵 ] 正式開始", width / 2, height / 2 + 160);
}

function handleStartInput(isSpacebarOrClick, isRKey = false) {
  if (stage === 0 && isSpacebarOrClick) {
    stage = 1; // 進入姓名輸入頁面
    setupNameInput();
  } else if (stage === 2 && isSpacebarOrClick) { // 從第一關說明進入第一關遊玩
    stage = 3;
    startStage1();
  } else if (stage === 4 && isSpacebarOrClick) { // 從第二關說明進入第二關遊玩
    problemCount = 0;
    stage = 5;
    startStage2();
  } else if (stage === 6 && isSpacebarOrClick) { // 從第三關說明進入第三關遊玩
    stage = 7;
    startStage3();
  } else if (stage === 8) { // 遊戲結束畫面
    if (nameInput) nameInput.remove();
    if (submitBtn) submitBtn.remove();
    if (randomBtn) randomBtn.remove();
    if (isRKey) { // 重新開始第三關
      stage = 7;
      startStage3();
    } else if (isSpacebarOrClick) { // 從頭開始
      resetGame();
    }
  }
}

function keyPressed() {
  if (keyCode === 32) {
    handleStartInput(true);
  } else if (stage === 8 && (key === 'r' || key === 'R')) {
    handleStartInput(false, true); // Pass true for isRKey
  }
}

function mouseClicked() {
  handleStartInput(true);
}

// ================= STAGE 2 INTRO =================
function drawStage2Intro() {
  fill(20, 20, 40, 240);
  rect(0, 0, width, height);
  fill(255);
  textSize(50);
  text("第二關：記憶＋反應", width / 2, height / 2 - 100);
  
  textSize(24);
  fill(200, 200, 255);
  text("注意：接下來將出現三個手勢讓你記憶 5 秒", width / 2, height / 2 - 40);
  text("隨後手勢會變成問號，你必須憑記憶按順序比出！", width / 2, height / 2);
  text("挑戰正式開始後，螢幕將不提供手勢提示。", width / 2, height / 2 + 40);
  
  let alpha = map(sin(frameCount * 0.1), -1, 1, 100, 255);
  fill(0, 255, 200, alpha);
  textSize(32);
  text("準備好了嗎？按下 [ 空白鍵 ] 開始記憶", width / 2, height / 2 + 160);
}

// ================= STAGE 3 INTRO =================
function drawStage3Intro() {
  fill(20, 20, 40, 240);
  rect(0, 0, width, height);
  fill(255);
  textSize(50);
  text("最終關：節奏挑戰", width / 2, height / 2 - 100);
  
  textSize(24);
  fill(200, 200, 255);
  text("這是一場節奏測試！手勢將會從上方掉落。", width / 2, height / 2 - 40);
  text("當符號移動到下方的 [ 紅線 ] 時，請立刻比出該手勢！", width / 2, height / 2);
  
  let alpha = map(sin(frameCount * 0.1), -1, 1, 100, 255);
  fill(0, 255, 200, alpha);
  textSize(32);
  text("按下 [ 空白鍵 ] 迎接挑戰", width / 2, height / 2 + 160);
}

// ================= STAGE 1 =================
function startStage1() {
  // 優先從還沒比過的手勢中隨機挑選
  let remaining = gestures.filter(g => !completedGestures.has(g));
  currentGesture = remaining.length > 0 ? random(remaining) : random(gestures);
}

function drawStage1() {
  fill(255);
  textSize(28);
  text("第一關：手勢模仿", width / 2, 40);
  textSize(20);
  text("請依照螢幕上的符號比出正確手勢", width / 2, 80);

  // --- 顯示手勢進度（亮起已完成的手勢） ---
  let startX = width / 2 - 105; // 讓四個符號置中的起始 X 座標
  let spacing = 70;             // 符號之間的間距
  for (let i = 0; i < gestures.length; i++) {
    let g = gestures[i];
    if (completedGestures.has(g)) {
      fill(255);                // 已完成：完全不透明（呈現亮起效果）
    } else {
      fill(255, 80);            // 未完成：半透明（呈現暗淡效果）
    }
    textSize(40);
    text(g, startX + i * spacing, 130);

    // 如果手勢已完成，在下方顯示綠色勾勾
    if (completedGestures.has(g)) {
      fill(0, 255, 0);
      textSize(20);
      text("✔", startX + i * spacing, 160);
    }
  }

  if (!showSuccess) {
    fill(255); // 恢復不透明度，繪製中間的大手勢
    textSize(80);
    text(currentGesture, width / 2, height / 2);
  }

  let gs = getGesture();

  if (gs.includes(currentGesture)) {
    if (!showSuccess) {
      score += 5; // 第一關答對加 5 分
      showSuccess = true;
      successTime = millis();
      completedGestures.add(currentGesture); // 紀錄成功完成的手勢
      
      // 觸發星星特效
      starEffect.active = true;
      starEffect.startTime = millis();

      // 觸發加分特效
      perfectEffect.active = true;
      perfectEffect.startTime = millis();
      perfectEffect.x = width / 2;
      perfectEffect.y = height / 2 - 100;
      perfectEffect.points = 5;
    }
  } else if (gs.length > 0 && !showSuccess) {
    // 若沒有比出正確手勢，直接給予提示
    let wrongG = gs.find(v => v !== "未定義" && v !== "pinch");
    if (wrongG) {
      if (flashRed <= 0) flashRed = 100; // 觸發紅光
      textSize(28);
      fill(255, 69, 0); 
      text("提示：目前偵測到「" + wrongG + "」", width / 2, height / 2 + 150);
    }
  } else if (!showSuccess) {
    textSize(22);
    fill(100);
    text("( 尚未偵測到手部 )", width / 2, height / 2 + 150);
  }

  if (showSuccess) {
    let waitTime = 1500; // 延長過場時間至 1.5 秒
    let elapsed = millis() - successTime;
    let progress = elapsed / waitTime;

    // --- 新增：彩色背景擴散環動畫 ---
    push();
    noFill();
    ellipseMode(CENTER);
    for (let i = 0; i < 4; i++) {
      let rSize = map(progress, 0, 1, 0, width * 1.5) + (i * 200);
      let rAlpha = map(progress, 0, 1, 180, 0);
      if (rAlpha > 0) {
        strokeWeight(50);
        // 使用 HSB 模式產生霓虹色彩
        colorMode(HSB, 360, 100, 100, 255);
        let h = (successTime / 10 + i * 45 + frameCount * 5) % 360;
        stroke(h, 80, 100, rAlpha);
        ellipse(width / 2, height / 2, rSize);
      }
    }
    pop(); // pop 會自動恢復預設的 RGB 模式

    push();
    textSize(30);
    fill(0, 255, 150);
    drawingContext.shadowBlur = 20;
    drawingContext.shadowColor = color(0, 255, 150);
    text("🌟 模仿成功！ 🌟", width / 2, height / 2 + 100);
    
    textSize(22);
    fill(255);
    text("準備下一個手勢...", width / 2, height / 2 + 150);
    pop();

    if (elapsed > waitTime) {
      showSuccess = false;
      // 如果四種都比過了，才進下一關
      if (completedGestures.size >= 4) {
        stage = 4; // 進入第二關說明
        startStage2();
      } else {
        startStage1();
      }
    }
  }

  // 在第一關繪製星星特效
  if (starEffect.active) {
    let elapsed = millis() - starEffect.startTime;
    if (elapsed < starEffect.duration) {
      let progress = elapsed / starEffect.duration;
      let s = sin(progress * PI) * 2.5; 
      push();
      translate(width / 2, height / 2);
      scale(s);
      drawingContext.shadowBlur = 35;
      drawingContext.shadowColor = color(255, 255, 0);
      textSize(50);
      fill(255, 255, 0, map(progress, 0.7, 1, 255, 0));
      text("⭐", 0, 0);
      pop();
    } else {
      starEffect.active = false;
    }
  }
}

// ================= STAGE 2 =================
function startStage2() {
  // 隨機產生三個「不重複」的手勢作為題目
  let available = [...gestures]; // 複製一份手勢清單
  targets = [];
  for (let i = 0; i < 3; i++) {
    let idx = floor(random(available.length));
    targets.push(available.splice(idx, 1)[0]); // 抽出一個並從可用清單移除，確保不重複
  }
  showTargets = true;
  showCountdown = false;
  showSuccess = false;
  roundIndex = 0;
  currentTarget = targets[0];
  displayedTargets = ['?', '?', '?']; // 初始化為問號
  startTime = millis(); // 重置計時器
}

function drawStage2() {
  fill(255);
  textSize(28);
  text("第二關：記憶＋反應 (第 " + (problemCount + 1) + " 題)", width / 2, 40);

  if (showTargets) {
    fill(255, 255, 0); // 使用黃色強調
    textSize(36);
    text("🔥 專心看！剩 5 秒可以記憶 🔥", width / 2, height / 2 - 120);
    fill(255);
    textSize(80);
    text(targets.join("  "), width / 2, height / 2);
    if (millis() - startTime > 5000) {
      showTargets = false;
      showCountdown = true;
      startTime = millis();
    }
    return;
  } else if (showCountdown) {
    let t = 3 - floor((millis() - startTime) / 1000);
    push();
    // 設定金黃色發光效果
    drawingContext.shadowBlur = 40;
    drawingContext.shadowColor = color(255, 255, 0);
    fill(255, 255, 200); // 淺黃色主體
    textSize(150);       // 放大數字
    text(t, width / 2, height / 2);
    pop();

    if (t <= 0) {
      showCountdown = false;
      playStartTime = millis();
      roundIndex = 0;
    }
    return;
  }

  textSize(80);
  text(displayedTargets.join("  "), width / 2, height / 2);

  let gs = getGesture();
  let timeLeft = max(0, (playLimit - (millis() - playStartTime)) / 1000);
  let handPos = null;
  if (hands.length > 0) {
    // 找到正確手勢的那隻手來顯示進度條，若無則顯示第一隻手
    let targetIdx = gs.indexOf(currentTarget);
    let hIdx = targetIdx !== -1 ? targetIdx : 0;
    handPos = createVector(
      map((hands[hIdx].keypoints[8].x + hands[hIdx].keypoints[4].x) / 2, 0, video.width, 0, width),
      map((hands[hIdx].keypoints[8].y + hands[hIdx].keypoints[4].y) / 2, 0, video.height, 0, height)
    );
  }

  if (!showSuccess) {
    fill(timeLeft < 3 ? color(255, 0, 0) : color(255, 200, 0));
    textSize(32);
    text("⌛ 剩餘時間：" + timeLeft.toFixed(1) + "s", width / 2, 110);

    if (timeLeft <= 0) {
      problemWon = false;
      showSuccess = true;
      successTime = millis();
      holdingCorrectGesture = false;
      flashRed = 180; // 時間到，強烈閃爍
    } else if (gs.includes(currentTarget)) {
      if (!holdingCorrectGesture) {
        holdingCorrectGesture = true;
        holdStartTime = millis();
      }

      let progress = (millis() - holdStartTime) / holdDuration;
      if (handPos) {
        push();
        translate(handPos.x, handPos.y);
        noFill();
        stroke(0, 255, 0);
        strokeWeight(8);
        let endAngle = map(progress, 0, 1, 0, TWO_PI);
        arc(0, 0, 100, 100, -HALF_PI, endAngle - HALF_PI);
        pop();
      }

      if (progress >= 1) {
        displayedTargets[roundIndex] = currentTarget;
        starEffect.active = true;
        starEffect.startTime = millis();
        roundIndex++;
        if (roundIndex >= 3) {
          score += 15;
          problemWon = true;
          showSuccess = true;
          // 觸發加分特效
          perfectEffect.active = true;
          perfectEffect.startTime = millis();
          perfectEffect.x = width / 2;
          perfectEffect.y = height / 2;
          perfectEffect.points = 15;
          successTime = millis();
        } else {
          currentTarget = targets[roundIndex];
        }
        holdingCorrectGesture = false;
      }
    } else if (gs.length > 0 && !gs.every(v => v === "未定義" || v === "pinch")) {
      if (flashRed <= 0) flashRed = 100; // 比錯手勢，觸發紅光
      holdingCorrectGesture = false;
    } else {
      holdingCorrectGesture = false;
    }
  }

  if (showSuccess) {
    textSize(30);
    if (problemWon) {
      fill(0, 255, 0);
      text("✔ 挑戰成功！ +15分", width / 2, height / 2 + 100);
    } else {
      fill(255, 0, 0);
      text("❌ 挑戰失敗！", width / 2, height / 2 + 100);
    }

    if (millis() - successTime > 1000) {
      showSuccess = false;
      problemCount++;
      if (problemCount >= 2) {
        stage = 6; // 進入第三關說明
      } else {
        startStage2();
      }
    }
  }

  if (starEffect.active) {
    let elapsed = millis() - starEffect.startTime;
    if (elapsed < starEffect.duration) {
      let progress = elapsed / starEffect.duration;
      let s = sin(progress * PI) * 2.5; 
      push();
      translate(width / 2, height / 2);
      scale(s);
      drawingContext.shadowBlur = 35;
      drawingContext.shadowColor = color(255, 255, 0);
      textSize(50);
      fill(255, 255, 0, map(progress, 0.7, 1, 255, 0));
      text("⭐", 0, 0);
      pop();
    } else {
      starEffect.active = false;
    }
  }
}

// ================= CONFETTI EFFECT =================
function initConfetti() {
  confetti = [];
  for (let i = 0; i < 150; i++) {
    confetti.push({
      x: random(width),
      y: random(-height, -20),
      size: random(8, 15),
      color: color(random(255), random(255), random(255)),
      vx: random(-2, 2),
      vy: random(3, 8),
      rot: random(TWO_PI),
      vRot: random(-0.1, 0.1)
    });
  }
}

function drawConfetti() {
  push();
  rectMode(CENTER);
  noStroke();
  for (let p of confetti) {
    fill(p.color);
    push();
    translate(p.x, p.y);
    rotate(p.rot);
    rect(0, 0, p.size, p.size / 2);
    pop();
    
    p.x += p.vx;
    p.y += p.vy;
    p.rot += p.vRot;
    
    // 循環落下
    if (p.y > height) {
      p.y = -20;
      p.x = random(width);
    }
  }
  pop();
}

// ================= STAGE 3 =================
function startStage3(sub = 1) {
  currentSubStage = sub;
  items = [];
  if (sub === 1) {
    collected = 0;
    stage3Score = 0;
    combo = 0;
  }
  showSuccess = false;
  
  // 基礎關(sub 1)速度放慢到 4000ms，進階關恢復 2500ms
  let noteTravelTime = sub === 1 ? 4000 : 2500; 
  let hitLineY = height * 0.8;
  let currentTimeOffset = 4000; // 初始等待時間增加到 4 秒，讓開局更輕鬆

  let totalNotes = sub === 1 ? 10 : 15; // 基礎10個，進階15組

  for (let i = 0; i < totalNotes; i++) {
    let targetArrivalTime = millis() + currentTimeOffset;
    
    // 產生第一個音符
    let gIdx1 = spawnNote(targetArrivalTime, noteTravelTime, -1);

    // 如果是進階關，有機率產生第二個同時掉落的音符
    if (sub === 2 && random() < 0.4) {
      spawnNote(targetArrivalTime, noteTravelTime, gIdx1);
    }

    // 難度曲線
    let baseInterval = sub === 1 ? map(i, 0, totalNotes-1, 3000, 2000) : map(i, 0, totalNotes-1, 2200, 1200);
    currentTimeOffset += baseInterval + random(-300, 300);
  }
}

function spawnNote(targetTime, travelTime, excludedGIdx) {
    let gIdx = floor(random(gestures.length));
    if (gIdx === excludedGIdx) gIdx = (gIdx + 1) % gestures.length;
    
    // 將四種手勢映射到四條垂直軌道
    let trackX = map(gIdx, 0, gestures.length - 1, width * 0.2, width * 0.8);
    
    items.push({
      x: trackX,
      y: -100,
      spawnY: -100,
      spawnTime: targetTime - travelTime,
      targetArrivalTime: targetTime,
      target: gestures[gIdx],
      collected: false,
      missed: false
    });
    return gIdx;
}

function drawStage3() {
  let hitLineY = height * 0.8; // 判定線高度
  let hitThreshold = 60;       // 判定容錯區間大小

  fill(255);
  textSize(28);
  text("第三關：節奏挑戰 (到達紅線時比出對應手勢)", width / 2, 40);

  // 繪製判定線
  stroke(255, 0, 0, 150);
  strokeWeight(4);
  line(0, hitLineY, width, hitLineY);
  noStroke();

  // 繪製四條軌道的背景提示（淡淡的符號）
  for (let i = 0; i < gestures.length; i++) {
    let trackX = map(i, 0, gestures.length - 1, width * 0.2, width * 0.8);
    fill(255, 50);
    textSize(40);
    text(gestures[i], trackX, hitLineY + 60);
  }

  // 繪製 Combo 顯示
  if (combo > 0) {
    push();
    textAlign(RIGHT, TOP);
    textSize(50);
    fill(255, 150, 0);
    // 移除耗能的 shadowBlur
    text(combo + " COMBO", width - 50, 100);
    pop();
  }

  // 取得快取的手勢
  let currentGs = getGesture();
  
  // 檢查是否有 3-1 結束後進入 3-2 的轉場提示
  if (showSuccess && currentSubStage === 1) {
    fill(0, 255, 150);
    textSize(40);
    text("基础達成！進階挑戰開始...", width/2, height/2);
  }
  
  for (let item of items) {
    let now = millis();
    if (!item.collected && !item.missed) {
      // 移動音符
      // 只有當音樂時間達到音符的生成時間後才開始移動
      if (now >= item.spawnTime) {
        item.y = map(now, item.spawnTime, item.targetArrivalTime, item.spawnY, hitLineY);
      }

      // 繪製掉落中的音符
      fill(255);
      textSize(60);
      text(item.target, item.x, item.y);

      // 判定區間偵測
      let dY = abs(item.y - hitLineY);
      
      if (dY < hitThreshold) {
        // 檢查快取陣列中是否包含該音符要求的目標手勢
        if (currentGs.includes(item.target)) {
          item.collected = true;
          collected++;
          combo++; // 增加連擊
          
          // 基礎加 10，進階加 15
          let pointsAwarded = (currentSubStage === 1) ? 10 : 15;
          score += pointsAwarded;
          stage3Score += pointsAwarded;
          
          // 觸發星星特效
          starEffect.active = true;
          starEffect.startTime = millis();
          
          // 觸發 Perfect 文字特效
          perfectEffect.active = true;
          perfectEffect.startTime = millis();
          perfectEffect.x = item.x;
          perfectEffect.y = hitLineY;
          perfectEffect.points = pointsAwarded;
        }
      }

      // 漏掉判定 (音符掉出線外)
      if (now > item.targetArrivalTime + 100 && !item.collected) { // 給予 100ms 緩衝時間判斷是否漏掉
        item.missed = true;
        combo = 0; // 漏掉音符重置連擊
        score -= 5; // 沒答對扣五分
        
        // 觸發 Miss 文字特效
        missEffect.active = true;
        missEffect.startTime = millis();
        missEffect.x = item.x;
        missEffect.y = hitLineY;
        missEffect.points = 5;
        flashRed = 120; // 觸發紅光閃爍
      }
    }
  }

  // 檢查是否全部音符都處理完了
  let finished = items.every(item => item.collected || item.missed);
  if (finished && !gameOver && !showSuccess) {
    if (currentSubStage === 1) {
      if (stage3Score >= 40) {
        showSuccess = true;
        successTime = millis();
        setTimeout(() => {
          startStage3(2); // 進入進階關
        }, 1500);
      } else {
        // 沒達標直接結束
        endGame();
      }
    } else {
      endGame();
    }
  }
}

function endGame() {
  gameOver = true;
  finalScore = score;

  // 檢查是否打破歷史最高紀錄
  let topScore = (leaderboard.length > 0) ? leaderboard[0].score : 0;
  if (finalScore > topScore) {
    isNewHighScore = true;
    initConfetti();
  } else {
    isNewHighScore = false;
  }

  let hitRate = collected / (items.length || 1);
  if (hitRate >= 0.9) finalRating = "Excellent!";
  else if (hitRate >= 0.7) finalRating = "Good!";
  else finalRating = "Bad!";
  
  saveScoreToLeaderboard(); // 由於在遊戲開始前已經有姓名，此處直接儲存
  stage = 8;
}

// 新增：儲存分數至排行榜的函數
function saveScoreToLeaderboard() {
  let nameToSave = playerName || "匿名玩家";
  leaderboard.push({ name: nameToSave, score: finalScore });
  leaderboard.sort((a, b) => b.score - a.score); // 由高到低排序
  leaderboard = leaderboard.slice(0, 5); // 只保留前五名
  localStorage.setItem('gestureGameLeaderboard', JSON.stringify(leaderboard));
  
  scoreSaved = true;
}

// ================= GAME OVER =================
function drawGameOver() {
  fill(10, 10, 25, 230);
  rect(0, 0, width, height);

  // 如果是新高分，繪製噴發特效
  if (isNewHighScore) {
    drawConfetti();
    push();
    drawingContext.shadowBlur = 20;
    drawingContext.shadowColor = color(255, 255, 0);
    fill(255, 215, 0);
    textSize(50);
    text("🎊 新紀錄誕生 🎊", width / 2, height / 2 - 260);
    pop();
  }

  // 背景動畫：漂浮旋轉的手勢符號
  push();
  for (let i = 0; i < 15; i++) {
    // 使用 noise 產生平滑且隨機的運動軌跡
    let nx = noise(i * 10, frameCount * 0.005) * width * 1.2 - width * 0.1;
    let ny = noise(i * 10 + 50, frameCount * 0.005) * height * 1.2 - height * 0.1;
    let rot = frameCount * 0.01 + i;
    let g = gestures[i % gestures.length];
    
    push();
    translate(nx, ny);
    rotate(rot);
    textSize(40 + noise(i * 5, frameCount * 0.01) * 60);
    fill(255, 20); // 設定極低不透明度，作為背景裝飾
    text(g, 0, 0);
    pop();
  }
  pop();

  // 遊戲結束 UI 內容
  drawingContext.shadowBlur = 30;
  drawingContext.shadowColor = color(0, 255, 255);
  fill(255);
  textSize(80);
  text("遊戲結束！", width / 2, height / 2 - 180);

  textSize(40);
  text("最終分數：" + finalScore, width / 2, height / 2 - 90);
  text("評價：" + finalRating, width / 2, height / 2 - 40);

  // --- 繪製排行榜 ---
  textSize(28);
  fill(0, 255, 255);
  text("🏆 本地排行榜 (Top 5) 🏆", width / 2, height / 2 + 30);
  
  if (!scoreSaved) {
    // 更新輸入框位置以因應視窗縮放
    nameInput.position(width / 2 - 130, height / 2 + 60);
    submitBtn.position(width / 2 + 50, height / 2 + 60);
    fill(200);
    textSize(16);
    text("請輸入姓名並點擊送出以紀錄成績", width / 2, height / 2 + 110);
  }

  textSize(22);
  for (let i = 0; i < leaderboard.length; i++) {
    let rankColor, medal;
    if (i === 0) {
      rankColor = color(255, 215, 0); // 金色
      medal = "🥇 ";
    } else if (i === 1) {
      rankColor = color(192, 192, 192); // 銀色
      medal = "🥈 ";
    } else if (i === 2) {
      rankColor = color(205, 127, 50); // 銅色
      medal = "🥉 ";
    } else {
      rankColor = 255;
      medal = (i + 1) + ". ";
    }

    fill(rankColor);
    let entry = leaderboard[i];
    text(medal + entry.name + " : " + entry.score + " pts", width / 2, height / 2 + 140 + i * 32);
  }

  textSize(20);
  fill(200);
  text("按下 [ R ] 重新開始第三關 或 按下 [ 空白鍵 ] 從頭開始", width / 2, height - 50);
  drawingContext.shadowBlur = 0;
}

// ================= RESET GAME =================
function resetGame() {
  stage = 0;
  score = 0;
  completedGestures.clear();
  
  if (nameInput) nameInput.remove();
  if (submitBtn) submitBtn.remove();
  if (randomBtn) randomBtn.remove();
  
  problemCount = 0;
  gameOver = false;
  showSuccess = false;
  currentSubStage = 1;
  isNewHighScore = false;
  confetti = [];
}

// ================= UI =================
function drawUI() {
  if (stage === 7) return; // 遊戲結束畫面隱藏頂部 UI

  fill(255);
  textSize(22);
  textAlign(LEFT, TOP);
  text("✨ 分數：" + score, 30, 30);
  
  // 轉換顯示關卡 (讓說明面不影響關卡數字)
  let displayStage = stage === 0 ? 0 : (stage <= 2 ? 1 : (stage <= 4 ? 2 : (stage === 6 ? "3-" + currentSubStage : 3)));
  text("🏆 關卡：" + displayStage, 30, 65); //
  textAlign(CENTER, CENTER);
}
