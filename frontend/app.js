const socket = io(); // Подключается к текущему хосту
let myName = "";
let mySymbol = "";
let currentRoom = "";
let isMyTurn = false;
let boardState = ["", "", "", "", "", "", "", "", ""];

function findGame() {
    myName = document.getElementById('username').value;
    if (!myName) return alert("Введите имя!");
    
    document.getElementById('login-panel').classList.add('hidden');
    document.getElementById('game-panel').classList.remove('hidden');
    document.getElementById('status').innerText = "Поиск соперника...";
    
    socket.emit('find_match', myName);
}

socket.on('match_found', (data) => {
    currentRoom = data.room;
    if (data.p1 === myName) {
        mySymbol = "X";
        isMyTurn = true;
        document.getElementById('status').innerText = "Ваш ход (X)";
    } else {
        mySymbol = "O";
        isMyTurn = false;
        document.getElementById('status').innerText = "Ход соперника (X)";
    }
});

function makeMove(index) {
    if (!isMyTurn || boardState[index] !== "") return;
    
    boardState[index] = mySymbol;
    updateBoardUI();
    
    let winner = checkWinner();
    isMyTurn = false;
    
    if (!winner) document.getElementById('status').innerText = "Ход соперника...";
    else document.getElementById('status').innerText = winner === "Draw" ? "Ничья!" : `Победил ${winner}!`;

    socket.emit('make_move', {
        roomId: currentRoom,
        board: boardState,
        winner: winner,
        turn: mySymbol === "X" ? "O" : "X"
    });
}

socket.on('opponent_moved', (data) => {
    boardState = data.board;
    updateBoardUI();
    
    if (!data.winner) {
        isMyTurn = true;
        document.getElementById('status').innerText = "Ваш ход!";
    } else {
        document.getElementById('status').innerText = data.winner === "Draw" ? "Ничья!" : `Победил ${data.winner}!`;
    }
});

function updateBoardUI() {
    const cells = document.querySelectorAll('.cell');
    cells.forEach((cell, i) => cell.innerText = boardState[i]);
}

function checkWinner() {
    const winPatterns = [
        [0,1,2], [3,4,5], [6,7,8], // Горизонтали
        [0,3,6], [1,4,7], [2,5,8], // Вертикали
        [0,4,8], [2,4,6]           // Диагонали
    ];
    for (let pattern of winPatterns) {
        const [a, b, c] = pattern;
        if (boardState[a] && boardState[a] === boardState[b] && boardState[a] === boardState[c]) {
            return boardState[a];
        }
    }
    return boardState.includes("") ? null : "Draw";
}