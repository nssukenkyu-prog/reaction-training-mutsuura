// ========================================
// Firebase初期化
// ========================================
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js';
import { 
    getAuth, 
    signInAnonymously, 
    onAuthStateChanged 
} from 'https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js';
import { 
    getFirestore, 
    collection, 
    addDoc, 
    query, 
    where, 
    orderBy, 
    limit, 
    getDocs,
    serverTimestamp
} from 'https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js';

// ========================================
// ⚠️ ここに自分のFirebase設定を入れてください
// ========================================
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_AUTH_DOMAIN",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_STORAGE_BUCKET",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Firebase初期化
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// 現在のユーザー
let currentUser = null;

// 匿名認証
signInAnonymously(auth).catch((error) => {
    console.error('匿名認証エラー:', error);
});

// 認証状態の監視
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        console.log('匿名ユーザーでログイン:', user.uid);
    }
});

// ========================================
// モード定義
// ========================================
const modes = [
    {
        id: 'simple',
        name: '単純反応モード',
        nameEn: 'Simple Reaction',
        description: '光や音が来たら、すぐにタップ！',
        icon: '⚡',
        quickTip: '光ったら すぐタップ！'
    },
    {
        id: 'choice',
        name: '選択反応モード',
        nameEn: 'Choice Reaction',
        description: '正しいものだけを選んでタップ！',
        icon: '🎯',
        quickTip: '正しいものだけ 選ぼう！'
    },
    {
        id: 'multimodal',
        name: 'マルチモーダル反応モード',
        nameEn: 'Multi-Modal Reaction',
        description: '色・音・形など、いろいろな刺激に反応！',
        icon: '🎨',
        quickTip: 'いろいろな刺激に 注意しよう！'
    },
    {
        id: 'math',
        name: '算数リアクションモード',
        nameEn: 'Math Reaction',
        description: '計算問題を速く解こう！',
        icon: '🔢',
        quickTip: '速く正確に 計算しよう！'
    },
    {
        id: 'japanese',
        name: '国語リアクションモード',
        nameEn: 'Japanese Reaction',
        description: '漢字や言葉の問題に反応！',
        icon: '📖',
        quickTip: '漢字や言葉を よく見よう！'
    },
    {
        id: 'memory',
        name: '記憶リアクションモード',
        nameEn: 'Memory Reaction',
        description: '覚えたことを思い出して反応！',
        icon: '🧠',
        quickTip: 'しっかり覚えて 思い出そう！'
    },
    {
        id: 'spatial',
        name: '空間認知リアクションモード',
        nameEn: 'Spatial Reaction',
        description: '図形や方向を判断！',
        icon: '🔄',
        quickTip: '図形や方向を よく見よう！'
    },
    {
        id: 'master',
        name: '複合チャレンジモード',
        nameEn: 'Master Challenge',
        description: 'すべての力を試す最強モード！',
        icon: '👑',
        quickTip: '全力で挑戦だ！'
    }
];

// ========================================
// レベル定義（1〜6）
// ========================================
const levels = [1, 2, 3, 4, 5, 6];

// ========================================
// 状態管理
// ========================================
let currentMode = null;
let currentLevel = null;
let currentTrial = 0;
let totalTrials = 10;
let reactionTimes = [];
let correctCount = 0;
let startTime = 0;
let trainingData = [];
let currentRankingScope = 'all'; // ランキングフィルタの状態

// ========================================
// クラス情報取得
// ========================================
function getClassInfo() {
    return {
        grade: document.getElementById('grade-input').value || null,
        className: document.getElementById('class-input').value || null,
        studentNumber: document.getElementById('student-number-input').value || null
    };
}

// ========================================
// ユーティリティ関数
// ========================================

// ランダムな遅延を生成
function randomDelay(min, max) {
    return Math.random() * (max - min) + min;
}

// ランダムな配列要素を取得
function randomChoice(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

// ランダムな色を生成
function randomColor() {
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F'];
    return randomChoice(colors);
}

// スコア計算（反応時間、正答率、レベルを考慮）
function calculateScore(avgReactionTime, accuracy, level) {
    const baseScore = 1000;
    const timeBonus = Math.max(0, 500 - avgReactionTime);
    const accuracyBonus = accuracy * 500;
    const levelMultiplier = 1 + (level - 1) * 0.2; // Lv1=1.0, Lv6=2.0
    return Math.round((baseScore + timeBonus + accuracyBonus) * levelMultiplier);
}

// 音を鳴らす（Web Audio API）
function playSound(frequency = 440, duration = 200) {
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = frequency;
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration / 1000);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + duration / 1000);
    } catch (error) {
        console.warn('音声再生エラー:', error);
    }
}

// 日付フォーマット
function formatDate(timestamp) {
    const date = new Date(timestamp);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${month}/${day} ${hours}:${minutes}`;
}

// ========================================
// Firebase - スコア保存
// ========================================
async function saveScoreToFirebase(resultData) {
    if (!currentUser) {
        console.error('ユーザーが認証されていません');
        showSaveStatus('error', 'オンライン保存できませんでしたが、記録は残っています');
        return;
    }

    try {
        const classInfo = getClassInfo();
        const scoreData = {
            userId: currentUser.uid,
            mode: resultData.mode,
            modeName: resultData.modeName,
            level: resultData.level,
            score: resultData.score,
            avgReactionTime: resultData.avgReactionTime,
            correctCount: resultData.correctCount,
            totalTrials: resultData.totalTrials,
            accuracy: resultData.accuracy,
            grade: classInfo.grade,
            className: classInfo.className,
            studentNumber: classInfo.studentNumber,
            createdAt: serverTimestamp()
        };

        await addDoc(collection(db, 'scores'), scoreData);
        console.log('スコアが保存されました:', scoreData);
        showSaveStatus('success', '✓ スコアが保存されました！');
    } catch (error) {
        console.error('スコア保存エラー:', error);
        showSaveStatus('error', 'オンライン保存できませんでしたが、記録は残っています');
    }
}

// ========================================
// Firebase - ランキング取得
// ========================================
async function loadRanking(modeId, level) {
    try {
        showRankingLoading();

        const classInfo = getClassInfo();
        const scoresRef = collection(db, 'scores');
        
        // クエリ条件を動的に構築
        let queryConstraints = [
            where('mode', '==', modeId),
            where('level', '==', level)
        ];

        // 範囲フィルタに応じて条件追加
        if (currentRankingScope === 'grade' && classInfo.grade) {
            queryConstraints.push(where('grade', '==', classInfo.grade));
        } else if (currentRankingScope === 'class' && classInfo.grade && classInfo.className) {
            queryConstraints.push(where('grade', '==', classInfo.grade));
            queryConstraints.push(where('className', '==', classInfo.className));
        }

        queryConstraints.push(orderBy('score', 'desc'));
        queryConstraints.push(limit(10));

        const q = query(scoresRef, ...queryConstraints);
        const querySnapshot = await getDocs(q);
        const rankings = [];

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            rankings.push({
                id: doc.id,
                userId: data.userId,
                score: data.score,
                avgReactionTime: data.avgReactionTime,
                correctCount: data.correctCount,
                totalTrials: data.totalTrials,
                accuracy: data.accuracy,
                grade: data.grade,
                className: data.className,
                studentNumber: data.studentNumber,
                createdAt: data.createdAt ? data.createdAt.toMillis() : Date.now()
            });
        });

        if (rankings.length === 0) {
            showRankingEmpty();
        } else {
            displayRanking(rankings);
        }
    } catch (error) {
        console.error('ランキング取得エラー:', error);
        showRankingError();
    }
}

// ========================================
// 保存状態メッセージ表示
// ========================================
function showSaveStatus(type, message) {
    const statusElement = document.getElementById('save-status-message');
    statusElement.textContent = message;
    statusElement.className = `save-status ${type}`;
}

// ========================================
// ランキング表示制御
// ========================================
function showRankingLoading() {
    document.getElementById('ranking-loading').classList.remove('hidden');
    document.getElementById('ranking-empty').classList.add('hidden');
    document.getElementById('ranking-error').classList.add('hidden');
    document.getElementById('ranking-table').classList.add('hidden');
}

function showRankingEmpty() {
    document.getElementById('ranking-loading').classList.add('hidden');
    document.getElementById('ranking-empty').classList.remove('hidden');
    document.getElementById('ranking-error').classList.add('hidden');
    document.getElementById('ranking-table').classList.add('hidden');
}

function showRankingError() {
    document.getElementById('ranking-loading').classList.add('hidden');
    document.getElementById('ranking-empty').classList.add('hidden');
    document.getElementById('ranking-error').classList.remove('hidden');
    document.getElementById('ranking-table').classList.add('hidden');
}

function displayRanking(rankings) {
    document.getElementById('ranking-loading').classList.add('hidden');
    document.getElementById('ranking-empty').classList.add('hidden');
    document.getElementById('ranking-error').classList.add('hidden');
    document.getElementById('ranking-table').classList.remove('hidden');

    const tbody = document.getElementById('ranking-tbody');
    tbody.innerHTML = '';

    rankings.forEach((rank, index) => {
        const tr = document.createElement('tr');
        
        // 自分のスコアをハイライト
        if (currentUser && rank.userId === currentUser.uid) {
            tr.classList.add('highlight');
        }

        // 順位バッジ
        let rankBadge = `<span class="rank-badge">${index + 1}位</span>`;
        if (index === 0) {
            rankBadge = `<span class="rank-badge rank-1">🥇 1位</span>`;
        } else if (index === 1) {
            rankBadge = `<span class="rank-badge rank-2">🥈 2位</span>`;
        } else if (index === 2) {
            rankBadge = `<span class="rank-badge rank-3">🥉 3位</span>`;
        }

        // 学年・クラス表示
        let classDisplay = '-';
        if (rank.grade && rank.className) {
            classDisplay = `${rank.grade}年${rank.className}組`;
        } else if (rank.grade) {
            classDisplay = `${rank.grade}年`;
        }

        // 出席番号表示
        const studentNumber = rank.studentNumber || '-';

        // 正答率表示
        const accuracyDisplay = rank.accuracy ? `${rank.accuracy}%` : '-';

        tr.innerHTML = `
            <td>${rankBadge}</td>
            <td>${classDisplay}</td>
            <td>${studentNumber}番</td>
            <td><strong>${rank.score}</strong></td>
            <td>${(rank.avgReactionTime / 1000).toFixed(3)}s</td>
            <td>${accuracyDisplay}</td>
        `;

        tbody.appendChild(tr);
    });
}

// ========================================
// 画面遷移関数
// ========================================
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.add('hidden');
    });
    document.getElementById(screenId).classList.remove('hidden');
}

// ========================================
// モード選択画面の初期化
// ========================================
function initModeSelection() {
    const modeCardsContainer = document.getElementById('mode-cards');
    modeCardsContainer.innerHTML = '';

    modes.forEach(mode => {
        const card = document.createElement('div');
        card.className = 'mode-card';
        card.setAttribute('data-mode', mode.id);
        card.innerHTML = `
            <h3>${mode.icon} ${mode.name}</h3>
            <p>${mode.description}</p>
        `;
        card.addEventListener('click', () => {
            currentMode = mode;
            showLevelSelection();
        });
        modeCardsContainer.appendChild(card);
    });
}

// ========================================
// ランキング画面の初期化
// ========================================
function initRankingScreen() {
    const modeSelect = document.getElementById('ranking-mode-select');
    modeSelect.innerHTML = '';

    modes.forEach(mode => {
        const option = document.createElement('option');
        option.value = mode.id;
        option.textContent = mode.name;
        modeSelect.appendChild(option);
    });

    // 範囲フィルタボタンのイベント
    document.querySelectorAll('.scope-button').forEach(button => {
        button.addEventListener('click', () => {
            document.querySelectorAll('.scope-button').forEach(btn => {
                btn.classList.remove('active');
            });
            button.classList.add('active');
            currentRankingScope = button.getAttribute('data-scope');
        });
    });
}

// ========================================
// レベル選択画面の表示
// ========================================
function showLevelSelection() {
    document.getElementById('selected-mode-title').textContent = currentMode.name;
    document.getElementById('selected-mode-description').textContent = currentMode.description;

    const levelButtonsContainer = document.getElementById('level-buttons');
    levelButtonsContainer.innerHTML = '';

    levels.forEach(level => {
        const button = document.createElement('button');
        button.className = 'level-button';
        button.textContent = `Lv.${level}`;
        button.addEventListener('click', () => {
            currentLevel = level;
            showTrainingScreen();
        });
        levelButtonsContainer.appendChild(button);
    });

    showScreen('level-selection');
}

// ========================================
// トレーニング画面の表示
// ========================================
function showTrainingScreen() {
    document.getElementById('training-mode-title').textContent = currentMode.name;
    document.getElementById('training-level-info').textContent = `レベル: ${currentLevel}`;
    
    // データをリセット
    currentTrial = 0;
    reactionTimes = [];
    correctCount = 0;
    trainingData = [];
    
    // 準備フェーズを表示
    document.getElementById('preparation-phase').classList.remove('hidden');
    document.getElementById('training-phase').classList.add('hidden');
    
    // ルール説明とクイックティップを設定
    const instruction = getInstructionText(currentMode.id, currentLevel);
    document.getElementById('instruction-text').textContent = instruction;
    document.getElementById('quick-tip').textContent = currentMode.quickTip;
    
    showScreen('training-screen');
}

// ========================================
// ルール説明テキスト取得
// ========================================
function getInstructionText(modeId, level) {
    const instructions = {
        simple: {
            1: '画面が緑色になったら、できるだけ速くタップしてください。',
            2: '音が鳴ったら、できるだけ速くタップしてください。',
            3: '光または音が来たら、できるだけ速くタップしてください。',
            4: '緑色の時だけタップしてください。赤色の時はタップしないでください。',
            5: '連続で反応します。できるだけ速く正確にタップしてください。',
            6: '緑色+音が来たらタップ、赤色+音が来たら右にスワイプしてください。'
        },
        choice: {
            1: '赤色のものだけをタップしてください。青色は無視してください。',
            2: '指定された形（丸/四角/三角）だけをタップしてください。',
            3: '指定された色と形の組み合わせをタップしてください。',
            4: '画面下の禁止ルールに反するものだけをタップしてください。',
            5: '条件に応じて左エリアまたは右エリアをタップしてください。',
            6: 'ラウンドごとにルールが変わります。表示されたルールに従ってください。'
        },
        multimodal: {
            1: '光と音の両方が来たらタップしてください。',
            2: '高音なら右にスワイプ、低音なら左にスワイプしてください。',
            3: '表示されたテキスト（タップ/スワイプ）に従って操作してください。',
            4: '音声の指示に従ってください。画面の文字は無視してください。',
            5: '画像・音声・文字のうち、指定された優先順位に従って反応してください。',
            6: '毎回変わる優先順位に従って反応してください。高度な注意力が必要です。'
        },
        math: {
            1: '表示された2つの数字のうち、大きい方をタップしてください。',
            2: '計算問題の正しい答えをタップしてください。',
            3: '計算結果が偶数なら右スワイプ、奇数なら左スワイプしてください。',
            4: '2つの計算結果を比べて、大きい方をタップしてください。',
            5: '3の倍数または5の倍数の場合のみタップしてください。',
            6: '複合計算（例：(8-3)×2）を素早く解いて答えをタップしてください。'
        },
        japanese: {
            1: '同じ漢字を選んでタップしてください。',
            2: '意味に合う漢字をタップしてください。',
            3: '対義語または類義語をタップしてください。',
            4: '熟語の空欄に当てはまる漢字をタップしてください。',
            5: 'ことわざの意味として正しいものをタップしてください。',
            6: '四字熟語の意味が正しければタップ、誤りなら右スワイプしてください。'
        },
        memory: {
            1: '最初に表示された色と同じ色が出たらタップしてください。',
            2: '記憶した2つの数字の和が7以上ならタップ、未満なら右スワイプしてください。',
            3: '記憶した3つの単語が後で登場したらタップしてください。',
            4: '記憶した順番（赤→青→黄）と同じ順序で出たらタップしてください。',
            5: '短い文章を記憶し、後で出る質問に正しければタップ、誤りなら右スワイプしてください。',
            6: '色・数字・単語の複合記憶課題です。すべてが一致したらタップしてください。'
        },
        spatial: {
            1: '同じ図形をタップしてください。',
            2: '回転した図形の中から元の図形と同じものをタップしてください。',
            3: '線対称または点対称の図形をタップしてください。',
            4: '矢印が示す方向にスワイプしてください。',
            5: '移動するオブジェクトの向きに応じてスワイプしてください。',
            6: '図形・方向・色をすべて考慮して正しい方向にスワイプしてください。'
        },
        master: {
            1: '単純反応と選択反応の要素が混在します。集中してください。',
            2: 'マルチモーダルと算数の要素が混在します。',
            3: '国語と記憶の要素が混在します。',
            4: '空間認知とマルチモーダルの要素が混在します。',
            5: '複数のモードがランダムに現れます。柔軟に対応してください。',
            6: 'すべての要素が現れるボス戦です。全力で挑んでください！'
        }
    };
    
    return instructions[modeId][level] || 'トレーニングを開始してください。';
}

// ========================================
// トレーニング開始
// ========================================
function startTraining() {
    document.getElementById('preparation-phase').classList.add('hidden');
    document.getElementById('training-phase').classList.remove('hidden');
    currentTrial = 0;
    
    // モード・レベルに応じたトレーニングを実行
    executeTraining();
}

// ========================================
// トレーニング実行（モード・レベル振り分け）
// ========================================
function executeTraining() {
    if (currentTrial >= totalTrials) {
        showResults();
        return;
    }
    
    currentTrial++;
    updateTrialCounter();
    
    // 各モードのトレーニングロジックを呼び出し
    const modeHandlers = {
        simple: executeSimpleMode,
        choice: executeChoiceMode,
        multimodal: executeMultimodalMode,
        math: executeMathMode,
        japanese: executeJapaneseMode,
        memory: executeMemoryMode,
        spatial: executeSpatialMode,
        master: executeMasterMode
    };
    
    const handler = modeHandlers[currentMode.id];
    if (handler) {
        handler(currentLevel);
    }
}

// ========================================
// トライアルカウンター更新
// ========================================
function updateTrialCounter() {
    document.getElementById('trial-counter').textContent = `${currentTrial}/${totalTrials}`;
}

// ========================================
// 反応記録
// ========================================
function recordReaction(reactionTime, isCorrect) {
    reactionTimes.push(reactionTime);
    if (isCorrect) correctCount++;
    trainingData.push({
        trial: currentTrial,
        reactionTime,
        isCorrect,
        timestamp: Date.now()
    });
}

// ========================================
// モード1: 単純反応モード
// ========================================
function executeSimpleMode(level) {
    const trainingArea = document.getElementById('training-area');
    trainingArea.innerHTML = '';
    
    if (level === 1) {
        // Lv1: 光（色）反応
        setTimeout(() => {
            trainingArea.style.backgroundColor = '#4ECDC4';
            startTime = performance.now();
            
            trainingArea.onclick = () => {
                const reactionTime = performance.now() - startTime;
                recordReaction(reactionTime, true);
                trainingArea.style.backgroundColor = '#f9f9f9';
                trainingArea.onclick = null;
                setTimeout(() => executeTraining(), 500);
            };
        }, randomDelay(1000, 3000));
        
    } else if (level === 2) {
        // Lv2: 音反応
        trainingArea.innerHTML = '<div class="swipe-zone">音が鳴ったらタップ</div>';
        setTimeout(() => {
            playSound(880, 200);
            startTime = performance.now();
            
            trainingArea.onclick = () => {
                const reactionTime = performance.now() - startTime;
                recordReaction(reactionTime, true);
                trainingArea.onclick = null;
                setTimeout(() => executeTraining(), 500);
            };
        }, randomDelay(1000, 3000));
        
    } else if (level === 3) {
        // Lv3: 光または音
        const useLight = Math.random() > 0.5;
        setTimeout(() => {
            if (useLight) {
                trainingArea.style.backgroundColor = '#FFA07A';
            } else {
                playSound(660, 200);
            }
            startTime = performance.now();
            
            trainingArea.onclick = () => {
                const reactionTime = performance.now() - startTime;
                recordReaction(reactionTime, true);
                trainingArea.style.backgroundColor = '#f9f9f9';
                trainingArea.onclick = null;
                setTimeout(() => executeTraining(), 500);
            };
        }, randomDelay(1000, 3000));
        
    } else if (level === 4) {
        // Lv4: フェイント（赤=NG、緑=OK）
        const isGreen = Math.random() > 0.3;
        const color = isGreen ? '#4ECDC4' : '#FF6B6B';
        
        setTimeout(() => {
            trainingArea.style.backgroundColor = color;
            startTime = performance.now();
            let responded = false;
            
            trainingArea.onclick = () => {
                if (responded) return;
                responded = true;
                const reactionTime = performance.now() - startTime;
                recordReaction(reactionTime, isGreen);
                trainingArea.style.backgroundColor = '#f9f9f9';
                trainingArea.onclick = null;
                setTimeout(() => executeTraining(), 500);
            };
            
            // 3秒経過したら次へ
            setTimeout(() => {
                if (!responded) {
                    recordReaction(3000, !isGreen); // 反応しなかった = 赤なら正解
                    trainingArea.style.backgroundColor = '#f9f9f9';
                    trainingArea.onclick = null;
                    setTimeout(() => executeTraining(), 500);
                }
            }, 3000);
        }, randomDelay(1000, 2500));
        
    } else if (level === 5) {
        // Lv5: 連続反応
        executeSimpleMode(1); // Lv1を繰り返す
        
    } else if (level === 6) {
        // Lv6: 緑+音=タップ、赤+音=右スワイプ
        const isGreen = Math.random() > 0.5;
        const color = isGreen ? '#4ECDC4' : '#FF6B6B';
        
        setTimeout(() => {
            trainingArea.style.backgroundColor = color;
            playSound(440, 200);
            startTime = performance.now();
            
            let startX = 0;
            let responded = false;
            
            trainingArea.ontouchstart = (e) => {
                startX = e.touches[0].clientX;
            };
            
            trainingArea.ontouchmove = (e) => {
                if (responded) return;
                const deltaX = e.touches[0].clientX - startX;
                if (Math.abs(deltaX) > 50) {
                    responded = true;
                    const reactionTime = performance.now() - startTime;
                    const isSwipeRight = deltaX > 0;
                    recordReaction(reactionTime, !isGreen && isSwipeRight);
                    trainingArea.style.backgroundColor = '#f9f9f9';
                    trainingArea.ontouchstart = null;
                    trainingArea.ontouchmove = null;
                    trainingArea.onclick = null;
                    setTimeout(() => executeTraining(), 500);
                }
            };
            
            trainingArea.onclick = () => {
                if (responded) return;
                responded = true;
                const reactionTime = performance.now() - startTime;
                recordReaction(reactionTime, isGreen);
                trainingArea.style.backgroundColor = '#f9f9f9';
                trainingArea.ontouchstart = null;
                trainingArea.ontouchmove = null;
                trainingArea.onclick = null;
                setTimeout(() => executeTraining(), 500);
            };
        }, randomDelay(1000, 2500));
    }
}

// ========================================
// モード2: 選択反応モード
// ========================================
function executeChoiceMode(level) {
    const trainingArea = document.getElementById('training-area');
    trainingArea.innerHTML = '';
    
    if (level === 1) {
        // Lv1: 赤をタップ、青は無視
        const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1'];
        const targetColor = '#FF6B6B';
        const choices = [];
        
        for (let i = 0; i < 3; i++) {
            choices.push(randomChoice(colors));
        }
        if (!choices.includes(targetColor)) {
            choices[Math.floor(Math.random() * choices.length)] = targetColor;
        }
        
        const container = document.createElement('div');
        container.className = 'choice-container';
        
        startTime = performance.now();
        
        choices.forEach(color => {
            const item = document.createElement('div');
            item.className = 'choice-item';
            item.style.backgroundColor = color;
            item.onclick = () => {
                const reactionTime = performance.now() - startTime;
                const isCorrect = color === targetColor;
                recordReaction(reactionTime, isCorrect);
                setTimeout(() => executeTraining(), 500);
            };
            container.appendChild(item);
        });
        
        trainingArea.appendChild(container);
        
    } else if (level === 2) {
        // Lv2: 指定された形をタップ
        const shapes = ['●', '■', '▲'];
        const targetShape = randomChoice(shapes);
        
        trainingArea.innerHTML = `<p style="font-size: 2.5rem; margin-bottom: 2rem;">「${targetShape}」をタップ</p>`;
        
        const container = document.createElement('div');
        container.className = 'choice-container';
        
        startTime = performance.now();
        
        shapes.forEach(shape => {
            const item = document.createElement('div');
            item.className = 'choice-item';
            item.style.backgroundColor = '#667eea';
            item.textContent = shape;
            item.onclick = () => {
                const reactionTime = performance.now() - startTime;
                const isCorrect = shape === targetShape;
                recordReaction(reactionTime, isCorrect);
                setTimeout(() => executeTraining(), 500);
            };
            container.appendChild(item);
        });
        
        trainingArea.appendChild(container);
        
    } else if (level === 3) {
        // Lv3: 色×形の複合
        const colors = ['#FF6B6B', '#4ECDC4', '#FFA07A'];
        const shapes = ['●', '■', '▲'];
        const targetColor = randomChoice(colors);
        const targetShape = randomChoice(shapes);
        
        trainingArea.innerHTML = `<p style="font-size: 2.5rem; margin-bottom: 2rem; color: ${targetColor};">「${targetShape}」を選択</p>`;
        
        const container = document.createElement('div');
        container.className = 'choice-container';
        
        startTime = performance.now();
        
        for (let i = 0; i < 4; i++) {
            const color = randomChoice(colors);
            const shape = randomChoice(shapes);
            const item = document.createElement('div');
            item.className = 'choice-item';
            item.style.backgroundColor = color;
            item.textContent = shape;
            item.onclick = () => {
                const reactionTime = performance.now() - startTime;
                const isCorrect = color === targetColor && shape === targetShape;
                recordReaction(reactionTime, isCorrect);
                setTimeout(() => executeTraining(), 500);
            };
            container.appendChild(item);
        }
        
        trainingArea.appendChild(container);
        
    } else if (level >= 4) {
        // Lv4以降: 簡略化（Lv3のバリエーション）
        executeChoiceMode(3);
    }
}

// ========================================
// モード3: マルチモーダル反応モード
// ========================================
function executeMultimodalMode(level) {
    const trainingArea = document.getElementById('training-area');
    trainingArea.innerHTML = '';
    
    if (level === 1) {
        // Lv1: 光+音の両方が来たらタップ
        const hasBoth = Math.random() > 0.3;
        
        setTimeout(() => {
            if (hasBoth) {
                trainingArea.style.backgroundColor = '#4ECDC4';
                playSound(660, 200);
            } else {
                if (Math.random() > 0.5) {
                    trainingArea.style.backgroundColor = '#4ECDC4';
                } else {
                    playSound(660, 200);
                }
            }
            
            startTime = performance.now();
            let responded = false;
            
            trainingArea.onclick = () => {
                if (responded) return;
                responded = true;
                const reactionTime = performance.now() - startTime;
                recordReaction(reactionTime, hasBoth);
                trainingArea.style.backgroundColor = '#f9f9f9';
                trainingArea.onclick = null;
                setTimeout(() => executeTraining(), 500);
            };
            
            setTimeout(() => {
                if (!responded) {
                    recordReaction(3000, !hasBoth);
                    trainingArea.style.backgroundColor = '#f9f9f9';
                    trainingArea.onclick = null;
                    setTimeout(() => executeTraining(), 500);
                }
            }, 3000);
        }, randomDelay(1000, 2500));
        
    } else if (level === 2) {
        // Lv2: 高音=右、低音=左
        const isHigh = Math.random() > 0.5;
        const freq = isHigh ? 880 : 440;
        
        setTimeout(() => {
            playSound(freq, 300);
            startTime = performance.now();
            
            let startX = 0;
            let responded = false;
            
            trainingArea.ontouchstart = (e) => {
                startX = e.touches[0].clientX;
            };
            
            trainingArea.ontouchmove = (e) => {
                if (responded) return;
                const deltaX = e.touches[0].clientX - startX;
                if (Math.abs(deltaX) > 50) {
                    responded = true;
                    const reactionTime = performance.now() - startTime;
                    const isSwipeRight = deltaX > 0;
                    const isCorrect = (isHigh && isSwipeRight) || (!isHigh && !isSwipeRight);
                    recordReaction(reactionTime, isCorrect);
                    trainingArea.ontouchstart = null;
                    trainingArea.ontouchmove = null;
                    setTimeout(() => executeTraining(), 500);
                }
            };
        }, randomDelay(1000, 2500));
        
    } else {
        // Lv3以降: 簡略化
        executeMultimodalMode(1);
    }
}

// ========================================
// モード4: 算数リアクションモード
// ========================================
function executeMathMode(level) {
    const trainingArea = document.getElementById('training-area');
    trainingArea.innerHTML = '';
    
    if (level === 1) {
        // Lv1: 大きい方をタップ
        const num1 = Math.floor(Math.random() * 20) + 1;
        const num2 = Math.floor(Math.random() * 20) + 1;
        
        const container = document.createElement('div');
        container.className = 'choice-container';
        
        startTime = performance.now();
        
        [num1, num2].forEach(num => {
            const item = document.createElement('div');
            item.className = 'choice-item';
            item.style.backgroundColor = '#667eea';
            item.textContent = num;
            item.onclick = () => {
                const reactionTime = performance.now() - startTime;
                const isCorrect = num === Math.max(num1, num2);
                recordReaction(reactionTime, isCorrect);
                setTimeout(() => executeTraining(), 500);
            };
            container.appendChild(item);
        });
        
        trainingArea.appendChild(container);
        
    } else if (level === 2) {
        // Lv2: 簡単な計算
        const a = Math.floor(Math.random() * 10) + 1;
        const b = Math.floor(Math.random() * 10) + 1;
        const correctAnswer = a + b;
        const wrongAnswer = correctAnswer + Math.floor(Math.random() * 5) + 1;
        const answers = [correctAnswer, wrongAnswer].sort(() => Math.random() - 0.5);
        
        trainingArea.innerHTML = `<p class="question-display">${a} + ${b} = ?</p>`;
        
        const container = document.createElement('div');
        container.className = 'choice-container';
        
        startTime = performance.now();
        
        answers.forEach(answer => {
            const item = document.createElement('div');
            item.className = 'choice-item';
            item.style.backgroundColor = '#667eea';
            item.textContent = answer;
            item.onclick = () => {
                const reactionTime = performance.now() - startTime;
                const isCorrect = answer === correctAnswer;
                recordReaction(reactionTime, isCorrect);
                setTimeout(() => executeTraining(), 500);
            };
            container.appendChild(item);
        });
        
        trainingArea.appendChild(container);
        
    } else if (level === 3) {
        // Lv3: 偶数/奇数判定
        const a = Math.floor(Math.random() * 10) + 1;
        const b = Math.floor(Math.random() * 10) + 1;
        const result = a + b;
        const isEven = result % 2 === 0;
        
        trainingArea.innerHTML = `
            <p class="question-display">${a} + ${b}</p>
            <p style="font-size: 1.8rem; margin-top: 1rem;">偶数なら右、奇数なら左にスワイプ</p>
        `;
        
        startTime = performance.now();
        let startX = 0;
        let responded = false;
        
        trainingArea.ontouchstart = (e) => {
            startX = e.touches[0].clientX;
        };
        
        trainingArea.ontouchmove = (e) => {
            if (responded) return;
            const deltaX = e.touches[0].clientX - startX;
            if (Math.abs(deltaX) > 50) {
                responded = true;
                const reactionTime = performance.now() - startTime;
                const isSwipeRight = deltaX > 0;
                const isCorrect = (isEven && isSwipeRight) || (!isEven && !isSwipeRight);
                recordReaction(reactionTime, isCorrect);
                trainingArea.ontouchstart = null;
                trainingArea.ontouchmove = null;
                setTimeout(() => executeTraining(), 500);
            }
        };
        
    } else {
        // Lv4以降: 簡略化
        executeMathMode(2);
    }
}

// ========================================
// モード5: 国語リアクションモード
// ========================================
function executeJapaneseMode(level) {
    const trainingArea = document.getElementById('training-area');
    trainingArea.innerHTML = '';
    
    if (level === 1) {
        // Lv1: 同じ漢字を選ぶ
        const kanji = ['林', '森', '木', '林'];
        const target = '林';
        
        trainingArea.innerHTML = `<p style="font-size: 2.5rem; margin-bottom: 2rem;">「${target}」と同じ字をタップ</p>`;
        
        const container = document.createElement('div');
        container.className = 'choice-container';
        
        startTime = performance.now();
        
        kanji.forEach(char => {
            const item = document.createElement('div');
            item.className = 'choice-item';
            item.style.backgroundColor = '#667eea';
            item.textContent = char;
            item.onclick = () => {
                const reactionTime = performance.now() - startTime;
                const isCorrect = char === target;
                recordReaction(reactionTime, isCorrect);
                setTimeout(() => executeTraining(), 500);
            };
            container.appendChild(item);
        });
        
        trainingArea.appendChild(container);
        
    } else if (level === 2) {
        // Lv2: 意味に合う漢字
        const questions = [
            { question: '「木がたくさん」の意味は？', choices: ['森', '林', '村', '森'], answer: '森' },
            { question: '「水が流れる」の意味は？', choices: ['川', '海', '池', '川'], answer: '川' }
        ];
        const q = randomChoice(questions);
        
        trainingArea.innerHTML = `<p style="font-size: 2rem; margin-bottom: 2rem;">${q.question}</p>`;
        
        const container = document.createElement('div');
        container.className = 'choice-container';
        
        startTime = performance.now();
        
        q.choices.forEach(char => {
            const item = document.createElement('div');
            item.className = 'choice-item';
            item.style.backgroundColor = '#667eea';
            item.textContent = char;
            item.onclick = () => {
                const reactionTime = performance.now() - startTime;
                const isCorrect = char === q.answer;
                recordReaction(reactionTime, isCorrect);
                setTimeout(() => executeTraining(), 500);
            };
            container.appendChild(item);
        });
        
        trainingArea.appendChild(container);
        
    } else {
        // Lv3以降: 簡略化
        executeJapaneseMode(1);
    }
}

// ========================================
// モード6: 記憶リアクションモード
// ========================================
function executeMemoryMode(level) {
    const trainingArea = document.getElementById('training-area');
    trainingArea.innerHTML = '';
    
    if (level === 1) {
        // Lv1: 色を記憶
        const colors = ['#FF6B6B', '#4ECDC4', '#FFA07A', '#98D8C8'];
        const targetColor = randomChoice(colors);
        
        trainingArea.innerHTML = '<p class="memory-display">この色を覚えてください</p>';
        trainingArea.style.backgroundColor = targetColor;
        
        setTimeout(() => {
            trainingArea.style.backgroundColor = '#f9f9f9';
            trainingArea.innerHTML = '<p class="memory-display">待機中...</p>';
            
            setTimeout(() => {
                const testColor = Math.random() > 0.5 ? targetColor : randomChoice(colors);
                trainingArea.style.backgroundColor = testColor;
                trainingArea.innerHTML = '<p class="memory-display">同じ色ならタップ</p>';
                
                startTime = performance.now();
                let responded = false;
                
                trainingArea.onclick = () => {
                    if (responded) return;
                    responded = true;
                    const reactionTime = performance.now() - startTime;
                    const isCorrect = testColor === targetColor;
                    recordReaction(reactionTime, isCorrect);
                    trainingArea.style.backgroundColor = '#f9f9f9';
                    trainingArea.onclick = null;
                    setTimeout(() => executeTraining(), 500);
                };
                
                setTimeout(() => {
                    if (!responded) {
                        recordReaction(3000, testColor !== targetColor);
                        trainingArea.style.backgroundColor = '#f9f9f9';
                        trainingArea.onclick = null;
                        setTimeout(() => executeTraining(), 500);
                    }
                }, 3000);
            }, 1000);
        }, 2000);
        
    } else if (level === 2) {
        // Lv2: 2つの数字の和
        const num1 = Math.floor(Math.random() * 5) + 1;
        const num2 = Math.floor(Math.random() * 5) + 1;
        
        trainingArea.innerHTML = `<p class="memory-display">${num1} と ${num2}</p><p style="font-size: 1.8rem;">この2つの数字を覚えてください</p>`;
        
        setTimeout(() => {
            trainingArea.innerHTML = '<p class="memory-display">待機中...</p>';
            
            setTimeout(() => {
                const sum = num1 + num2;
                const threshold = 7;
                
                trainingArea.innerHTML = `<p class="memory-display">和が${threshold}以上ならタップ<br>未満なら右スワイプ</p>`;
                
                startTime = performance.now();
                let responded = false;
                let startX = 0;
                
                trainingArea.ontouchstart = (e) => {
                    startX = e.touches[0].clientX;
                };
                
                trainingArea.ontouchmove = (e) => {
                    if (responded) return;
                    const deltaX = e.touches[0].clientX - startX;
                    if (Math.abs(deltaX) > 50) {
                        responded = true;
                        const reactionTime = performance.now() - startTime;
                        const isCorrect = sum < threshold;
                        recordReaction(reactionTime, isCorrect);
                        trainingArea.ontouchstart = null;
                        trainingArea.ontouchmove = null;
                        trainingArea.onclick = null;
                        setTimeout(() => executeTraining(), 500);
                    }
                };
                
                trainingArea.onclick = () => {
                    if (responded) return;
                    responded = true;
                    const reactionTime = performance.now() - startTime;
                    const isCorrect = sum >= threshold;
                    recordReaction(reactionTime, isCorrect);
                    trainingArea.ontouchstart = null;
                    trainingArea.ontouchmove = null;
                    trainingArea.onclick = null;
                    setTimeout(() => executeTraining(), 500);
                };
            }, 1000);
        }, 2500);
        
    } else {
        // Lv3以降: 簡略化
        executeMemoryMode(1);
    }
}

// ========================================
// モード7: 空間認知リアクションモード
// ========================================
function executeSpatialMode(level) {
    const trainingArea = document.getElementById('training-area');
    trainingArea.innerHTML = '';
    
    if (level === 1) {
        // Lv1: 同じ図形を選ぶ
        const shapes = ['●', '■', '▲', '◆'];
        const target = randomChoice(shapes);
        
        trainingArea.innerHTML = `<p style="font-size: 2.5rem; margin-bottom: 2rem;">「${target}」と同じ図形をタップ</p>`;
        
        const container = document.createElement('div');
        container.className = 'choice-container';
        
        startTime = performance.now();
        
        shapes.forEach(shape => {
            const item = document.createElement('div');
            item.className = 'choice-item';
            item.style.backgroundColor = '#667eea';
            item.textContent = shape;
            item.onclick = () => {
                const reactionTime = performance.now() - startTime;
                const isCorrect = shape === target;
                recordReaction(reactionTime, isCorrect);
                setTimeout(() => executeTraining(), 500);
            };
            container.appendChild(item);
        });
        
        trainingArea.appendChild(container);
        
    } else if (level === 2) {
        // Lv2: 回転した図形（簡略版）
        executeSpatialMode(1);
        
    } else if (level === 4) {
        // Lv4: 矢印の方向にスワイプ
        const directions = ['↑', '→', '↓', '←'];
        const direction = randomChoice(directions);
        
        trainingArea.innerHTML = `<p class="question-display">${direction}</p><p style="font-size: 1.8rem;">矢印の方向にスワイプ</p>`;
        
        startTime = performance.now();
        let startX = 0;
        let startY = 0;
        let responded = false;
        
        trainingArea.ontouchstart = (e) => {
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
        };
        
        trainingArea.ontouchmove = (e) => {
            if (responded) return;
            const deltaX = e.touches[0].clientX - startX;
            const deltaY = e.touches[0].clientY - startY;
            
            if (Math.abs(deltaX) > 50 || Math.abs(deltaY) > 50) {
                responded = true;
                const reactionTime = performance.now() - startTime;
                
                let detectedDirection = '';
                if (Math.abs(deltaX) > Math.abs(deltaY)) {
                    detectedDirection = deltaX > 0 ? '→' : '←';
                } else {
                    detectedDirection = deltaY > 0 ? '↓' : '↑';
                }
                
                const isCorrect = detectedDirection === direction;
                recordReaction(reactionTime, isCorrect);
                trainingArea.ontouchstart = null;
                trainingArea.ontouchmove = null;
                setTimeout(() => executeTraining(), 500);
            }
        };
        
    } else {
        // その他のレベル: 簡略化
        executeSpatialMode(1);
    }
}

// ========================================
// モード8: 複合チャレンジモード
// ========================================
function executeMasterMode(level) {
    // ランダムに他のモードを実行
    const modes = ['simple', 'choice', 'multimodal', 'math', 'japanese', 'memory', 'spatial'];
    const randomMode = randomChoice(modes);
    const randomLevel = Math.floor(Math.random() * 3) + 1; // Lv1-3
    
    const handlers = {
        simple: executeSimpleMode,
        choice: executeChoiceMode,
        multimodal: executeMultimodalMode,
        math: executeMathMode,
        japanese: executeJapaneseMode,
        memory: executeMemoryMode,
        spatial: executeSpatialMode
    };
    
    handlers[randomMode](randomLevel);
}

// ========================================
// 結果表示
// ========================================
function showResults() {
    const avgReactionTime = reactionTimes.reduce((a, b) => a + b, 0) / reactionTimes.length;
    const accuracy = correctCount / totalTrials;
    const score = calculateScore(avgReactionTime, accuracy, currentLevel);
    
    // クラス情報取得
    const classInfo = getClassInfo();
    
    // 結果オブジェクト（Firebase連携用）
    const result = {
        mode: currentMode.id,
        modeName: currentMode.name,
        level: currentLevel,
        score: score,
        correctCount: correctCount,
        totalTrials: totalTrials,
        accuracy: Math.round(accuracy * 100),
        avgReactionTime: avgReactionTime,
        timestamp: Date.now(),
        trainingData: trainingData
    };
    
    // 結果を表示
    document.getElementById('result-mode-level').textContent = `${currentMode.name} - レベル ${currentLevel}`;
    document.getElementById('result-score').textContent = score;
    document.getElementById('result-time').textContent = `${(avgReactionTime / 1000).toFixed(3)}s`;
    document.getElementById('result-correct').textContent = `${correctCount}/${totalTrials}`;
    document.getElementById('result-accuracy').textContent = `${Math.round(accuracy * 100)}%`;
    
    // 学生情報表示
    let studentInfo = '';
    if (classInfo.grade && classInfo.className && classInfo.studentNumber) {
        studentInfo = `${classInfo.grade}年${classInfo.className}組 ${classInfo.studentNumber}番`;
    } else if (classInfo.grade && classInfo.className) {
        studentInfo = `${classInfo.grade}年${classInfo.className}組`;
    }
    document.getElementById('result-student-info').textContent = studentInfo;
    
    console.log('Training Result:', result);
    
    // Firebaseにスコアを保存
    saveScoreToFirebase(result);
    
    showScreen('result-screen');
}

// ========================================
// イベントリスナー設定
// ========================================
function setupEventListeners() {
    // 戻るボタン
    document.getElementById('back-to-modes').addEventListener('click', () => {
        showScreen('mode-selection');
    });

    document.getElementById('back-to-levels').addEventListener('click', () => {
        showLevelSelection();
    });

    // スタートボタン
    document.getElementById('start-training-button').addEventListener('click', () => {
        startTraining();
    });

    // 結果画面のボタン
    document.getElementById('retry-button').addEventListener('click', () => {
        showTrainingScreen();
    });

    document.getElementById('back-to-mode-from-result').addEventListener('click', () => {
        showScreen('mode-selection');
    });

    document.getElementById('show-ranking-button').addEventListener('click', () => {
        // 現在のモードとレベルでランキングを表示
        document.getElementById('ranking-mode-select').value = currentMode.id;
        document.getElementById('ranking-level-select').value = currentLevel;
        loadRanking(currentMode.id, currentLevel);
        showScreen('ranking-screen');
    });

    // ランキングボタン（ヘッダー）
    document.getElementById('ranking-button').addEventListener('click', () => {
        showScreen('ranking-screen');
    });

    // ランキング画面
    document.getElementById('back-from-ranking').addEventListener('click', () => {
        showScreen('mode-selection');
    });

    document.getElementById('load-ranking-button').addEventListener('click', () => {
        const modeId = document.getElementById('ranking-mode-select').value;
        const level = parseInt(document.getElementById('ranking-level-select').value);
        loadRanking(modeId, level);
    });

    // 使い方ボタン
    document.getElementById('help-button').addEventListener('click', () => {
        showScreen('help-screen');
    });

    document.getElementById('back-from-help').addEventListener('click', () => {
        showScreen('mode-selection');
    });
}

// ========================================
// アプリ初期化
// ========================================
function initApp() {
    initModeSelection();
    initRankingScreen();
    setupEventListeners();
    showScreen('mode-selection');
}

// ========================================
// DOMContentLoaded後に初期化
// ========================================
document.addEventListener('DOMContentLoaded', initApp);
