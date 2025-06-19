let draggedGate = null;
let sourceDropzone = null;
let numLines = 4;
let numCols = 4;
let circuit = Array.from({ length: numLines }, () => Array(numCols).fill(null));
let cnotGates = [];
let gateHistory = [];

const circuitRoot = document.getElementById('circuit-root');
const gateHistoryBox = document.getElementById('gate-history-box');
const addLineBtn = document.getElementById('add-line');
const deleteLineBtn = document.getElementById('delete-line');
const resetBtn = document.getElementById('reset-circuit');
const trashcan = document.getElementById('trashcan');
let trashTarget = null;

function getDropzoneOffset(col) {
    // Find the first dropzone in the first line for the given column
    const lines = circuitRoot.querySelector('.circuit-lines');
    if (!lines) return 0;
    const firstLine = lines.children[0];
    if (!firstLine) return 0;
    const dropzones = firstLine.querySelectorAll('.circuit-dropzone');
    if (!dropzones[col]) return 0;
    const dzRect = dropzones[col].getBoundingClientRect();
    const rootRect = circuitRoot.getBoundingClientRect();
    // Center the CNOT overlay in the dropzone
    return dzRect.left - rootRect.left + dzRect.width / 2;
}

function renderCircuit() {
    circuitRoot.innerHTML = '';
    // Grid: labels | lines
    const labels = document.createElement('div');
    labels.className = 'circuit-labels';
    for (let i = 0; i < numLines; i++) {
        const label = document.createElement('div');
        label.textContent = `q${i + 1}`;
        labels.appendChild(label);
    }
    const lines = document.createElement('div');
    lines.className = 'circuit-lines';
    // For CNOT vertical lines, collect dropzone positions after rendering
    let dropzoneRefs = Array.from({ length: numLines }, () => Array(numCols).fill(null));
    for (let i = 0; i < numLines; i++) {
        const line = document.createElement('div');
        line.className = 'circuit-line';
        // Wire
        const wire = document.createElement('div');
        wire.className = 'circuit-wire';
        line.appendChild(wire);
        // Dropzones
        const dropzones = document.createElement('div');
        dropzones.className = 'circuit-dropzones';
        for (let j = 0; j < numCols; j++) {
            const dz = document.createElement('div');
            dz.className = 'circuit-dropzone';
            dz.dataset.pos = `${i}-${j}`;
            dropzoneRefs[i][j] = dz;
            // Render single-qubit gates
            if (circuit[i][j]) {
                const gate = document.createElement('div');
                gate.className = `gate ${circuit[i][j].type}`;
                gate.draggable = true;
                gate.dataset.gate = circuit[i][j].type;
                gate.textContent = circuit[i][j].type;
                addGateDragListeners(gate);
                dz.appendChild(gate);
            }
            // Render CNOT control/target
            const cnot = cnotGates.find(c => (c.control[0] === i && c.control[1] === j) || (c.target[0] === i && c.target[1] === j));
            if (cnot) {
                if (cnot.control[0] === i && cnot.control[1] === j) {
                    const control = document.createElement('div');
                    control.className = 'cnot-control';
                    dz.appendChild(control);
                }
                if (cnot.target[0] === i && cnot.target[1] === j) {
                    const target = document.createElement('div');
                    target.className = 'cnot-target';
                    target.innerHTML = '<span class="plus">&#8853;</span>';
                    dz.appendChild(target);
                }
            }
            addDropzoneListeners(dz);
            dropzones.appendChild(dz);
        }
        line.appendChild(dropzones);
        lines.appendChild(line);
    }
    circuitRoot.appendChild(labels);
    circuitRoot.appendChild(lines);
    // Render CNOT vertical lines
    setTimeout(() => {
        cnotGates.forEach(cnot => {
            const [r1, c1] = cnot.control;
            const [r2, c2] = cnot.target;
            if (c1 !== c2) return; // Only vertical
            const dz1 = dropzoneRefs[r1][c1];
            const dz2 = dropzoneRefs[r2][c2];
            if (!dz1 || !dz2) return;
            const rect1 = dz1.getBoundingClientRect();
            const rect2 = dz2.getBoundingClientRect();
            const rootRect = circuitRoot.getBoundingClientRect();
            const x = rect1.left + rect1.width / 2 - rootRect.left;
            const y1 = rect1.top + rect1.height / 2 - rootRect.top;
            const y2 = rect2.top + rect2.height / 2 - rootRect.top;
            const lineDiv = document.createElement('div');
            lineDiv.className = 'cnot-vertical-line';
            lineDiv.style.position = 'absolute';
            lineDiv.style.left = `${x - 2}px`;
            lineDiv.style.top = `${Math.min(y1, y2)}px`;
            lineDiv.style.width = '4px';
            lineDiv.style.height = `${Math.abs(y2 - y1)}px`;
            lineDiv.style.background = '#8e44ad';
            lineDiv.style.zIndex = 2;
            circuitRoot.appendChild(lineDiv);
        });
    }, 0);
}

function renderGateHistory() {
    gateHistoryBox.textContent = gateHistory.map(g => g.desc).join(' | ');
}

function enableTrashcan() {
    trashcan.addEventListener('dragover', (e) => {
        e.preventDefault();
        trashcan.classList.add('dragover');
    });
    trashcan.addEventListener('dragleave', () => {
        trashcan.classList.remove('dragover');
    });
    trashcan.addEventListener('drop', (e) => {
        e.preventDefault();
        trashcan.classList.remove('dragover');
        if (trashTarget) {
            if (trashTarget.type === 'gate') {
                circuit[trashTarget.row][trashTarget.col] = null;
                gateHistory = gateHistory.filter(g => g.desc !== trashTarget.historyDesc);
            } else if (trashTarget.type === 'cnot') {
                cnotGates = cnotGates.filter(c => !(c.control[0] === trashTarget.control[0] && c.control[1] === trashTarget.control[1] && c.target[0] === trashTarget.target[0] && c.target[1] === trashTarget.target[1]));
                gateHistory = gateHistory.filter(g => g.desc !== trashTarget.historyDesc);
            }
            trashTarget = null;
            renderCircuit();
            renderGateHistory();
        }
    });
}

function addDropzoneListeners(dropzone) {
    dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
    });
    dropzone.addEventListener('dragleave', () => {
        dropzone.classList.remove('dragover');
    });
    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        trashTarget = null;
        const pos = dropzone.dataset.pos.split('-').map(Number);
        let gateType = e.dataTransfer.getData('text/plain');
        // If moving a gate, remove it from its original position
        if (window.draggedFrom) {
            const [fromRow, fromCol] = window.draggedFrom;
            if (!(fromRow === pos[0] && fromCol === pos[1])) {
                circuit[fromRow][fromCol] = null;
                gateHistory = gateHistory.filter(g => g.desc !== `${gateType}(q${fromRow+1})@${fromCol+1}`);
            }
            window.draggedFrom = null;
        }
        if (gateType === 'CNOT') {
            // Only allow CNOT between adjacent lines
            if (pos[0] > 0 && !cnotGates.some(c => c.control[1] === pos[1] && (c.control[0] === pos[0]-1 || c.target[0] === pos[0]))) {
                cnotGates.push({ control: [pos[0]-1, pos[1]], target: [pos[0], pos[1]] });
                gateHistory.push({ desc: `CNOT(q${pos[0]},q${pos[0]+1})@${pos[1]+1}` });
            }
            renderCircuitAndCnotDrags();
            renderGateHistory();
            return;
        }
        // Single gate: replace
        circuit[pos[0]][pos[1]] = { type: gateType };
        gateHistory.push({ desc: `${gateType}(q${pos[0]+1})@${pos[1]+1}` });
        renderCircuitAndCnotDrags();
        renderGateHistory();
    });
}

function addGateDragListeners(gate) {
    // Only allow dragging if the gate is actually placed (not empty dropzone)
    gate.setAttribute('draggable', 'true');
    gate.addEventListener('dragstart', (e) => {
        draggedGate = gate;
        sourceDropzone = gate.parentElement;
        e.dataTransfer.setData('text/plain', gate.dataset.gate);
        // Mark for trash and for move
        const pos = sourceDropzone.dataset.pos.split('-').map(Number);
        trashTarget = {
            type: 'gate',
            row: pos[0],
            col: pos[1],
            historyDesc: `${gate.dataset.gate}(q${pos[0]+1})@${pos[1]+1}`
        };
        window.draggedFrom = pos;
        setTimeout(() => {
            gate.style.visibility = 'hidden';
        }, 0);
    });
    gate.addEventListener('dragend', () => {
        gate.style.visibility = 'visible';
        trashTarget = null;
        window.draggedFrom = null;
    });
}

// Add drag for CNOT controls/targets
function addCnotDragListeners() {
    setTimeout(() => {
        document.querySelectorAll('.cnot-control, .cnot-target').forEach(el => {
            el.setAttribute('draggable', 'true');
            el.addEventListener('dragstart', (e) => {
                // Find which CNOT this is
                const dz = el.parentElement;
                const pos = dz.dataset.pos.split('-').map(Number);
                let cnot = null;
                let historyDesc = '';
                if (el.classList.contains('cnot-control')) {
                    cnot = cnotGates.find(c => c.control[0] === pos[0] && c.control[1] === pos[1]);
                } else {
                    cnot = cnotGates.find(c => c.target[0] === pos[0] && c.target[1] === pos[1]);
                }
                if (cnot) {
                    historyDesc = `CNOT(q${Math.min(cnot.control[0],cnot.target[0])+1},q${Math.max(cnot.control[0],cnot.target[0])+1})@${cnot.control[1]+1}`;
                    trashTarget = {
                        type: 'cnot',
                        control: cnot.control,
                        target: cnot.target,
                        historyDesc
                    };
                }
            });
            el.addEventListener('dragend', () => {
                trashTarget = null;
            });
        });
    }, 0);
}

// Call after every render
function renderCircuitAndCnotDrags() {
    renderCircuit();
    addCnotDragListeners();
}

// Palette gates
const paletteGates = document.querySelectorAll('.gate-palette .gate');
paletteGates.forEach(gate => {
    gate.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', gate.dataset.gate);
    });
});

// Add/delete line
addLineBtn.addEventListener('click', () => {
    numLines++;
    circuit.push(Array(numCols).fill(null));
    renderCircuitAndCnotDrags();
});
deleteLineBtn.addEventListener('click', () => {
    if (numLines > 1) {
        numLines--;
        circuit.pop();
        cnotGates = cnotGates.filter(c => c.control[0] < numLines && c.target[0] < numLines);
        gateHistory = gateHistory.filter(g => {
            const matches = g.desc.match(/q(\d+)/g);
            if (!matches) return true;
            return matches.every(q => parseInt(q.slice(1)) <= numLines);
        });
        renderCircuitAndCnotDrags();
        renderGateHistory();
    }
});

// Reset button
resetBtn.addEventListener('click', () => {
    circuit = Array.from({ length: numLines }, () => Array(numCols).fill(null));
    cnotGates = [];
    gateHistory = [];
    renderCircuitAndCnotDrags();
    renderGateHistory();
});

enableTrashcan();

// Initial render
renderCircuitAndCnotDrags();
renderGateHistory(); 