let video;
let handPose;
let hands = [];

let stage = 0; // 0: 封面, 1: 第一關說明, 2: 第一關遊玩, 3: 第二關說明, 4: 第二關遊玩, 5: 第三關說明, 6: 第三關遊玩
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
let missEffect = { active: false, startTime: 0, duration: 800, x: 0, y: 0 }; // Miss 文字特效

let gameOver = false; // 遊戲是否結束
let finalScore = 0; // 最終分數
let finalRating = ""; // 最終評價

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

// 手指連線路徑群組
const FINGER_PARTS = [
  [0, 1, 2, 3, 4],     // 大拇指
  [5, 6, 7, 8],        // 食指
  [9, 10, 11, 12],     // 中指
  [13, 14, 15, 16],    // 無名指
  [17, 18, 19, 20]     // 小拇指
];

function preload() {
  handPose = ml5.handPose({ flipped: true });
}

function setup() {
  createCanvas(windowWidth, windowHeight);

  video = createCapture(VIDEO, { flipped: true });
  video.size(640, 480);
  video.hide();

  handPose.detectStart(video, gotHands);

  textAlign(CENTER, CENTER);

  // 初始化背景粒子
  for (let i = 0; i < 60; i++) {
    bgParticles.push({
      x: random(width), y: random(height),
      vx: random(-0.6, 0.6), vy: random(-0.6, 0.6),
      size: random(1, 4),
      c: color(random(150, 255), random(150, 255), 255, 120)
    });
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

// ================= DRAW =================
function draw() {
  // 背景美化：深色濾鏡效果
  background(15);
  tint(255, 130); 
  image(video, 0, 0, width, height);
  noTint();

  // 繪製動態粒子
  noStroke();
  for (let p of bgParticles) {
    p.x = (p.x + p.vx + width) % width;
    p.y = (p.y + p.vy + height) % height;
    fill(p.c);
    ellipse(p.x, p.y, p.size);
  }

  drawHand();

  if (stage === 0) drawCoverScreen();
  if (stage === 1) drawStage1Intro(); // 第一關說明
  if (stage === 2) drawStage1();     // 第一關遊玩
  if (stage === 3) drawStage2Intro(); // 第二關說明 (新增)
  if (stage === 4) drawStage2();     // 第二關遊玩 (原 stage 3)
  if (stage === 5) drawStage3Intro(); // 第三關說明 (新增)
  if (stage === 6) drawStage3();     // 第三關遊玩
  if (stage === 7) drawGameOver();   // 遊戲結束畫面

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

  drawUI();
}

// ================= HAND =================
function gotHands(results) {
  hands = results;
}

function getGesture() {
  if (hands.length === 0) return null;
  return recognizeGesture(hands[0]);
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
    drawingContext.shadowBlur = 15;
    drawingContext.shadowColor = col;
    stroke(col);
    strokeWeight(4);
    noFill();

    // 繪製手指連線
    for (let part of FINGER_PARTS) {
      for (let i = 0; i < part.length - 1; i++) {
        let p1 = hand.keypoints[part[i]];
        let p2 = hand.keypoints[part[i + 1]];
        
        // 將座標從影片大小 (640x480) 映射到畫布大小
        let x1 = map(p1.x, 0, 640, 0, width);
        let y1 = map(p1.y, 0, 480, 0, height);
        let x2 = map(p2.x, 0, 640, 0, width);
        let y2 = map(p2.y, 0, 480, 0, height);
        line(x1, y1, x2, y2);
      }
    }
    
    // 額外連接指根到手腕 (0號點) 讓骨架更完整
    let wrist = hand.keypoints[0];
    for (let baseIdx of [5, 9, 13, 17]) {
      let b = hand.keypoints[baseIdx];
      line(
        map(wrist.x, 0, 640, 0, width), map(wrist.y, 0, 480, 0, height),
        map(b.x, 0, 640, 0, width), map(b.y, 0, 480, 0, height)
      );
    }
    drawingContext.shadowBlur = 0;
  }
}

// ================= COVER SCREEN =================
function drawCoverScreen() {
  background(10, 10, 25, 200);
  
  // 霓虹發光標題
  drawingContext.shadowBlur = 30;
  drawingContext.shadowColor = color(0, 255, 255);
  fill(255);
  textSize(90);
  text("手勢挑戰大冒險", width / 2, height / 2 - 60);
  
  drawingContext.shadowBlur = 10;
  drawingContext.shadowColor = color(255, 100, 255);
  let alpha = map(sin(frameCount * 0.05), -1, 1, 80, 255);
  fill(255, alpha);
  textSize(28);
  text("按下 [ 空白鍵 ] 開始旅程", width / 2, height / 2 + 60);
  drawingContext.shadowBlur = 0;
}

function drawStage1Intro() {
  background(20, 20, 40, 240);
  fill(255);
  textSize(50);
  text("第一關：手勢模仿", width / 2, height / 2 - 100);
  
  textSize(24);
  fill(200, 200, 255);
  text("請依照螢幕上的符號比出正確手勢", width / 2, height / 2 - 30);
  
  textSize(20);
  fill(255);
  text("目標：收集滿 4 種手勢並亮起圖示", width / 2, height / 2 + 30);
  text("👌 OK | ✋ 布 | 👍 讚 | ✌ 剪刀", width / 2, height / 2 + 70);
  
  let alpha = map(sin(frameCount * 0.1), -1, 1, 100, 255);
  fill(0, 255, 200, alpha);
  textSize(30);
  text("按下 [ 空白鍵 ] 正式開始", width / 2, height / 2 + 160);
}

function handleStartInput(isSpacebarOrClick, isRKey = false) {
  if (stage === 0 && isSpacebarOrClick) {
    stage = 1;
  } else if (stage === 1 && isSpacebarOrClick) { // 從第一關說明進入第一關遊玩
    stage = 2;
    startStage1();
  } else if (stage === 3 && isSpacebarOrClick) { // 從第二關說明進入第二關遊玩
    problemCount = 0;
    stage = 4;
    startStage2();
  } else if (stage === 5 && isSpacebarOrClick) { // 從第三關說明進入第三關遊玩
    stage = 6;
    startStage3();
  } else if (stage === 7) { // 遊戲結束畫面
    if (isRKey) { // 重新開始第三關
      stage = 6;
      startStage3();
    } else if (isSpacebarOrClick) { // 從頭開始
      resetGame();
    }
  }
}

function keyPressed() {
  if (keyCode === 32) {
    handleStartInput(true);
  } else if (stage === 7 && (key === 'r' || key === 'R')) {
    handleStartInput(false, true); // Pass true for isRKey
  }
}

function mouseClicked() {
  handleStartInput(true);
}

// ================= STAGE 2 INTRO =================
function drawStage2Intro() {
  background(20, 20, 40, 240);
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
  background(20, 20, 40, 240);
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

  let g = getGesture();

  if (g && g === currentGesture) {
    if (!showSuccess) {
      score += 10;
      showSuccess = true;
      successTime = millis();
      completedGestures.add(currentGesture); // 紀錄成功完成的手勢
      
      // 觸發星星特效
      starEffect.active = true;
      starEffect.startTime = millis();
    }
  } else if (g && g !== "未定義" && g !== "pinch" && !showSuccess) {
    // 若沒有比出正確手勢，直接給予提示
    if (flashRed <= 0) flashRed = 100; // 觸發紅光
    textSize(28);
    fill(255, 69, 0); 
    text("提示：目前偵測到「" + g + "」", width / 2, height / 2 + 150);
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
        stage = 3; // 進入第二關說明
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

  let g = getGesture();
  let timeLeft = max(0, (playLimit - (millis() - playStartTime)) / 1000);
  let handPos = null;
  if (hands.length > 0) {
    handPos = createVector(
      map((hands[0].keypoints[8].x + hands[0].keypoints[4].x) / 2, 0, 640, 0, width),
      map((hands[0].keypoints[8].y + hands[0].keypoints[4].y) / 2, 0, 480, 0, height)
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
    } else if (g && g === currentTarget) {
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
          successTime = millis();
        } else {
          currentTarget = targets[roundIndex];
        }
        holdingCorrectGesture = false;
      }
    } else if (g && g !== "未定義" && g !== "pinch") {
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
        stage = 5; // 進入第三關說明
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
    drawingContext.shadowBlur = 20;
    drawingContext.shadowColor = color(255, 50, 0);
    text(combo + " COMBO", width - 50, 100);
    pop();
  }

  // 優化辨識：取得目前畫面上所有偵測到的手勢
  let detectedGestures = hands.map(h => recognizeGesture(h));
  
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
        // 如果偵測到的手勢中包含目標手勢
        if (detectedGestures.includes(item.target)) {
          item.collected = true;
          collected++;
          combo++; // 增加連擊
          
          // 連擊加分邏輯：連續成功時分數翻倍 (10 -> 20)
          let pointsAwarded = (combo >= 2) ? 20 : 10;
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
        
        // 觸發 Miss 文字特效
        missEffect.active = true;
        missEffect.startTime = millis();
        missEffect.x = item.x;
        missEffect.y = hitLineY;
        flashRed = 120; // 觸發紅光閃爍
      }
    }
  }

  // 繪製 Perfect 文字特效
  if (perfectEffect.active) {
    let elapsed = millis() - perfectEffect.startTime;
    if (elapsed < perfectEffect.duration) {
      let progress = elapsed / perfectEffect.duration;
      let alpha = map(progress, 0.6, 1, 255, 0, true); // 最後 40% 的時間淡出
      let yOffset = progress * -60; // 向上漂浮
      
      push();
      textAlign(CENTER, CENTER);
      textSize(45);
      fill(255, 255, 0, alpha); // 黃色文字
      drawingContext.shadowBlur = 25;
      drawingContext.shadowColor = color(255, 255, 0);
      text("Perfect! +" + perfectEffect.points, perfectEffect.x, perfectEffect.y + yOffset);
      pop();
    } else {
      perfectEffect.active = false;
    }
  }

  // 繪製 Miss 文字特效
  if (missEffect.active) {
    let elapsed = millis() - missEffect.startTime;
    if (elapsed < missEffect.duration) {
      let progress = elapsed / missEffect.duration;
      let alpha = map(progress, 0.6, 1, 255, 0, true); // 最後 40% 的時間淡出
      let yOffset = progress * -60; // 向上漂浮
      
      push();
      textAlign(CENTER, CENTER);
      textSize(45);
      fill(255, 0, 0, alpha); // 紅色文字
      drawingContext.shadowBlur = 25;
      drawingContext.shadowColor = color(255, 0, 0);
      text("Miss!", missEffect.x, missEffect.y + yOffset);
      pop();
    } else {
      missEffect.active = false;
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
  let hitRate = collected / items.length;
  if (hitRate >= 0.9) finalRating = "Excellent!";
  else if (hitRate >= 0.7) finalRating = "Good!";
  else finalRating = "Bad!";
  stage = 7;
}

// ================= GAME OVER =================
function drawGameOver() {
  background(10, 10, 25);

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
  text("遊戲結束！", width / 2, height / 2 - 100);

  textSize(40);
  text("最終分數：" + finalScore, width / 2, height / 2);
  text("評價：" + finalRating, width / 2, height / 2 + 60);

  textSize(24);
  text("按下 [ R ] 重新開始第三關 或 按下 [ 空白鍵 ] 從頭開始", width / 2, height / 2 + 150);
  drawingContext.shadowBlur = 0;
}

// ================= RESET GAME =================
function resetGame() {
  stage = 0;
  score = 0;
  completedGestures.clear();
  problemCount = 0;
  gameOver = false;
  showSuccess = false;
  currentSubStage = 1;
}

// ================= UI =================
function drawUI() {
  if (stage === 7) return; // 遊戲結束畫面隱藏頂部 UI

  drawingContext.shadowBlur = 10;
  drawingContext.shadowColor = color(0);
  fill(255);
  textSize(22);
  textAlign(LEFT, TOP);
  text("✨ 分數：" + score, 30, 30);
  
  // 轉換顯示關卡 (讓說明面不影響關卡數字)
  let displayStage = stage === 0 ? 0 : (stage <= 2 ? 1 : (stage <= 4 ? 2 : (stage === 6 ? "3-" + currentSubStage : 3)));
  text("🏆 關卡：" + displayStage, 30, 65); //
  drawingContext.shadowBlur = 0;
  textAlign(CENTER, CENTER);
}
