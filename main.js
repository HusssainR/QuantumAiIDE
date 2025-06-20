let draggedGate = null;
let sourceDropzone = null;
let numLines = 3;
let numCols = 8;
let circuit = Array.from({ length: numLines }, () => Array(numCols).fill(null));
let cnotGates = [];
let dcnotGates = [];
let measurements = [];
let gateHistory = [];
let movingCnot = null;
let movingCnotOrigin = null;
let movingDcnot = null;
let movingDcnotOrigin = null;
let movingMeasurement = null;
let movingMeasurementOrigin = null;

const circuitRoot = document.getElementById('circuit-root');
const gateHistoryBox = document.getElementById('gate-history-box');
const addLineBtn = document.getElementById('add-line');
const deleteLineBtn = document.getElementById('delete-line');
const resetBtn = document.getElementById('reset-circuit');
const trashcan = document.getElementById('trashcan');
const addSlotBtn = document.getElementById('add-slot');
const deleteSlotBtn = document.getElementById('delete-slot');
let trashTarget = null;

const chatInput = document.getElementById('chat-input');
const chatSend = document.getElementById('chat-send');
const chatMessages = document.getElementById('chat-messages');

const qiskitRunBtn = document.getElementById('qiskit-run');
const qiskitEditor = document.getElementById('qiskit-editor');

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
        label.textContent = `q[${i}]`;
        labels.appendChild(label);
    }
    // Add measurement label
    const mLabel = document.createElement('div');
    mLabel.textContent = 'c';
    labels.appendChild(mLabel);

    const lines = document.createElement('div');
    lines.className = 'circuit-lines';
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
            // Render DCNOT controls/target
            const dcnot = dcnotGates.find(dc =>
                (dc.controls[0][0] === i && dc.controls[0][1] === j) ||
                (dc.controls[1][0] === i && dc.controls[1][1] === j) ||
                (dc.target[0] === i && dc.target[1] === j)
            );
            if (dcnot) {
                if ((dcnot.controls[0][0] === i && dcnot.controls[0][1] === j) || (dcnot.controls[1][0] === i && dcnot.controls[1][1] === j)) {
                    const control = document.createElement('div');
                    control.className = 'dcnot-control';
                    dz.appendChild(control);
                }
                if (dcnot.target[0] === i && dcnot.target[1] === j) {
                    const target = document.createElement('div');
                    target.className = 'dcnot-target';
                    target.innerHTML = '<span class="plus">&#8853;</span>';
                    dz.appendChild(target);
                }
            }
            // Render measurement
            const meas = measurements.find(m => m.row === i && m.col === j);
            if (meas) {
                const mbox = document.createElement('div');
                mbox.className = 'measurement-box';
                mbox.innerHTML = '<svg width="28" height="28" viewBox="0 0 28 28"><rect x="4" y="4" width="20" height="20" rx="6" fill="#888" stroke="#fff" stroke-width="2"/><path d="M8 16 Q14 8 20 16" stroke="#222" stroke-width="2" fill="none"/><line x1="14" y1="16" x2="14" y2="20" stroke="#222" stroke-width="2"/></svg>';
                mbox.setAttribute('draggable', 'true');
                mbox.dataset.meas = `${i}-${j}`;
                dz.appendChild(mbox);
            }
            addDropzoneListeners(dz);
            dropzones.appendChild(dz);
        }
        line.appendChild(dropzones);
        lines.appendChild(line);
    }
    // Add measurement line (no dropzones, just a wire)
    const mLine = document.createElement('div');
    mLine.className = 'circuit-line';
    const mWire = document.createElement('div');
    mWire.className = 'circuit-wire';
    mLine.appendChild(mWire);
    lines.appendChild(mLine);

    circuitRoot.appendChild(labels);
    circuitRoot.appendChild(lines);
    // Render CNOT and DCNOT vertical lines and measurement dashes
    setTimeout(() => {
        // CNOT
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
        // DCNOT
        dcnotGates.forEach(dcnot => {
            const [c1, c2] = dcnot.controls;
            const t = dcnot.target;
            const dzc1 = dropzoneRefs[c1[0]][c1[1]];
            const dzc2 = dropzoneRefs[c2[0]][c2[1]];
            const dzt = dropzoneRefs[t[0]][t[1]];
            if (!dzc1 || !dzc2 || !dzt) return;
            const rectc1 = dzc1.getBoundingClientRect();
            const rectc2 = dzc2.getBoundingClientRect();
            const rectt = dzt.getBoundingClientRect();
            const rootRect = circuitRoot.getBoundingClientRect();
            // Line from c1 to t
            const x1 = rectc1.left + rectc1.width / 2 - rootRect.left;
            const y1 = rectc1.top + rectc1.height / 2 - rootRect.top;
            const xt = rectt.left + rectt.width / 2 - rootRect.left;
            const yt = rectt.top + rectt.height / 2 - rootRect.top;
            const lineDiv1 = document.createElement('div');
            lineDiv1.className = 'dcnot-vertical-line';
            lineDiv1.style.left = `${x1 - 2}px`;
            lineDiv1.style.top = `${Math.min(y1, yt)}px`;
            lineDiv1.style.width = '4px';
            lineDiv1.style.height = `${Math.abs(yt - y1)}px`;
            circuitRoot.appendChild(lineDiv1);
            // Line from c2 to t
            const x2 = rectc2.left + rectc2.width / 2 - rootRect.left;
            const y2 = rectc2.top + rectc2.height / 2 - rootRect.top;
            const lineDiv2 = document.createElement('div');
            lineDiv2.className = 'dcnot-vertical-line';
            lineDiv2.style.left = `${x2 - 2}px`;
            lineDiv2.style.top = `${Math.min(y2, yt)}px`;
            lineDiv2.style.width = '4px';
            lineDiv2.style.height = `${Math.abs(yt - y2)}px`;
            circuitRoot.appendChild(lineDiv2);
        });
        // Measurement dashed lines
        measurements.forEach(m => {
            const dz = dropzoneRefs[m.row][m.col];
            // Find the measurement line wire for this column
            const mLineWire = mLine.querySelector('.circuit-wire');
            if (!dz || !mLineWire) return;
            const rect1 = dz.getBoundingClientRect();
            const rect2 = mLineWire.getBoundingClientRect();
            const rootRect = circuitRoot.getBoundingClientRect();
            const x = rect1.left + rect1.width / 2 - rootRect.left;
            const y1 = rect1.top + rect1.height - rootRect.top;
            const y2 = rect2.top + rect2.height / 2 - rootRect.top;
            const dash = document.createElement('div');
            dash.className = 'measurement-dash';
            dash.style.left = `${x - 1}px`;
            dash.style.top = `${y1}px`;
            dash.style.width = '2px';
            dash.style.height = `${y2 - y1}px`;
            circuitRoot.appendChild(dash);
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
            } else if (trashTarget.type === 'dcnot') {
                dcnotGates = dcnotGates.filter(dc => !(dc.controls[0][0] === trashTarget.controls[0][0] && dc.controls[0][1] === trashTarget.controls[0][1] && dc.controls[1][0] === trashTarget.controls[1][0] && dc.controls[1][1] === trashTarget.controls[1][1] && dc.target[0] === trashTarget.target[0] && dc.target[1] === trashTarget.target[1]));
                gateHistory = gateHistory.filter(g => g.desc !== trashTarget.historyDesc);
            } else if (trashTarget.type === 'measurement') {
                measurements = measurements.filter(m => !(m.row === trashTarget.row && m.col === trashTarget.col));
                gateHistory = gateHistory.filter(g => g.desc !== trashTarget.historyDesc);
            }
            trashTarget = null;
            movingCnot = null;
            movingCnotOrigin = null;
            movingDcnot = null;
            movingDcnotOrigin = null;
            movingMeasurement = null;
            movingMeasurementOrigin = null;
            renderCircuitAndCnotDrags();
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
        // Prevent stacking: check if any component is already present in this dropzone
        const hasGate = circuit[pos[0]][pos[1]];
        const hasCnot = cnotGates.some(c => (c.control[0] === pos[0] && c.control[1] === pos[1]) || (c.target[0] === pos[0] && c.target[1] === pos[1]));
        const hasDcnot = dcnotGates.some(dc => (dc.controls[0][0] === pos[0] && dc.controls[0][1] === pos[1]) || (dc.controls[1][0] === pos[0] && dc.controls[1][1] === pos[1]) || (dc.target[0] === pos[0] && dc.target[1] === pos[1]));
        const hasMeas = measurements.some(m => m.row === pos[0] && m.col === pos[1]);
        if (hasGate || hasCnot || hasDcnot || hasMeas) {
            dropzone.classList.add('dropzone-error');
            setTimeout(() => dropzone.classList.remove('dropzone-error'), 400);
            return;
        }
        // If moving a DCNOT, handle as a move
        if (movingDcnot) {
            if (pos[0] > 1 && !dcnotGates.some(dc => dc.target[0] === pos[0] && dc.target[1] === pos[1])) {
                // Remove original
                dcnotGates = dcnotGates.filter(dc => !(dc.controls[0][0] === movingDcnot.controls[0][0] && dc.controls[0][1] === movingDcnot.controls[0][1] && dc.controls[1][0] === movingDcnot.controls[1][0] && dc.controls[1][1] === movingDcnot.controls[1][1] && dc.target[0] === movingDcnot.target[0] && dc.target[1] === movingDcnot.target[1]));
                gateHistory = gateHistory.filter(g => g.desc !== movingDcnotOrigin);
                // Add new
                dcnotGates.push({ controls: [[pos[0]-2, pos[1]], [pos[0]-1, pos[1]]], target: [pos[0], pos[1]] });
                gateHistory.push({ desc: `DCNOT(q[${pos[0]-2}],q[${pos[0]-1}],q[${pos[0]}])@${pos[1]}` });
            }
            movingDcnot = null;
            movingDcnotOrigin = null;
            renderCircuitAndCnotDrags();
            renderGateHistory();
            return;
        }
        // If moving a measurement, handle as a move
        if (movingMeasurement) {
            if (!measurements.some(m => m.row === pos[0] && m.col === pos[1])) {
                // Remove original
                measurements = measurements.filter(m => !(m.row === movingMeasurement.row && m.col === movingMeasurement.col));
                gateHistory = gateHistory.filter(g => g.desc !== movingMeasurementOrigin);
                // Add new
                const bit = getNextClassicalBit(pos[1]);
                measurements.push({ row: pos[0], col: pos[1], bit });
                gateHistory.push({ desc: `M(q[${pos[0]}])->c[${bit}]@${pos[1]}` });
            }
            movingMeasurement = null;
            movingMeasurementOrigin = null;
            renderCircuitAndCnotDrags();
            renderGateHistory();
            return;
        }
        // DCNOT
        if (gateType === 'DCNOT') {
            if (pos[0] > 1 && !dcnotGates.some(dc => dc.target[0] === pos[0] && dc.target[1] === pos[1])) {
                dcnotGates.push({ controls: [[pos[0]-2, pos[1]], [pos[0]-1, pos[1]]], target: [pos[0], pos[1]] });
                gateHistory.push({ desc: `DCNOT(q[${pos[0]-2}],q[${pos[0]-1}],q[${pos[0]}])@${pos[1]}` });
            }
            renderCircuitAndCnotDrags();
            renderGateHistory();
            return;
        }
        // Measurement
        if (gateType === 'M') {
            if (!measurements.some(m => m.row === pos[0] && m.col === pos[1])) {
                const bit = getNextClassicalBit(pos[1]);
                measurements.push({ row: pos[0], col: pos[1], bit });
                gateHistory.push({ desc: `M(q[${pos[0]}])->c[${bit}]@${pos[1]}` });
            }
            renderCircuitAndCnotDrags();
            renderGateHistory();
            return;
        }
        // If moving a CNOT, handle as a move
        if (movingCnot) {
            // Only allow CNOT between adjacent lines
            if (pos[0] > 0 && !cnotGates.some(c => c.control[1] === pos[1] && (c.control[0] === pos[0]-1 || c.target[0] === pos[0]))) {
                // Remove original
                cnotGates = cnotGates.filter(c => !(c.control[0] === movingCnot.control[0] && c.control[1] === movingCnot.control[1] && c.target[0] === movingCnot.target[0] && c.target[1] === movingCnot.target[1]));
                gateHistory = gateHistory.filter(g => g.desc !== movingCnotOrigin);
                // Add new
                cnotGates.push({ control: [pos[0]-1, pos[1]], target: [pos[0], pos[1]] });
                gateHistory.push({ desc: `CNOT(q${pos[0]},q${pos[0]+1})@${pos[1]+1}` });
            }
            movingCnot = null;
            movingCnotOrigin = null;
            renderCircuitAndCnotDrags();
            renderGateHistory();
            return;
        }
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
                    movingCnot = cnot;
                    movingCnotOrigin = historyDesc;
                }
            });
            el.addEventListener('dragend', (e) => {
                // If not dropped on a valid slot or trash, do nothing (CNOT remains)
                trashTarget = null;
                movingCnot = null;
                movingCnotOrigin = null;
            });
        });
    }, 0);
}

// Add drag for DCNOT controls/target
function addDcnotDragListeners() {
    setTimeout(() => {
        document.querySelectorAll('.dcnot-control, .dcnot-target').forEach(el => {
            el.setAttribute('draggable', 'true');
            el.addEventListener('dragstart', (e) => {
                const dz = el.parentElement;
                const pos = dz.dataset.pos.split('-').map(Number);
                let dcnot = null;
                let historyDesc = '';
                if (el.classList.contains('dcnot-control')) {
                    dcnot = dcnotGates.find(dc => (dc.controls[0][0] === pos[0] && dc.controls[0][1] === pos[1]) || (dc.controls[1][0] === pos[0] && dc.controls[1][1] === pos[1]));
                } else {
                    dcnot = dcnotGates.find(dc => dc.target[0] === pos[0] && dc.target[1] === pos[1]);
                }
                if (dcnot) {
                    historyDesc = `DCNOT(q[${dcnot.controls[0][0]}],q[${dcnot.controls[1][0]}],q[${dcnot.target[0]}])@${dcnot.target[1]}`;
                    trashTarget = {
                        type: 'dcnot',
                        controls: dcnot.controls,
                        target: dcnot.target,
                        historyDesc
                    };
                    movingDcnot = dcnot;
                    movingDcnotOrigin = historyDesc;
                }
            });
            el.addEventListener('dragend', (e) => {
                trashTarget = null;
                movingDcnot = null;
                movingDcnotOrigin = null;
            });
        });
    }, 0);
}

// Add drag for measurement boxes
function addMeasurementDragListeners() {
    setTimeout(() => {
        document.querySelectorAll('.measurement-box').forEach(el => {
            el.setAttribute('draggable', 'true');
            el.addEventListener('dragstart', (e) => {
                const dz = el.parentElement;
                const pos = dz.dataset.pos.split('-').map(Number);
                let meas = measurements.find(m => m.row === pos[0] && m.col === pos[1]);
                if (meas) {
                    const historyDesc = `M(q[${meas.row}])->c[${meas.bit}]@${meas.col}`;
                    trashTarget = {
                        type: 'measurement',
                        row: meas.row,
                        col: meas.col,
                        historyDesc
                    };
                    movingMeasurement = meas;
                    movingMeasurementOrigin = historyDesc;
                }
            });
            el.addEventListener('dragend', (e) => {
                trashTarget = null;
                movingMeasurement = null;
                movingMeasurementOrigin = null;
            });
        });
    }, 0);
}

function renderCircuitAndCnotDrags() {
    renderCircuit();
    addCnotDragListeners();
    addDcnotDragListeners();
    addMeasurementDragListeners();
}

// Palette gates
const paletteGates = document.querySelectorAll('.gate-palette .gate');
paletteGates.forEach(gate => {
    gate.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', gate.dataset.gate);
    });
    // Allow drop from circuit to palette to delete
    gate.addEventListener('dragover', (e) => {
        e.preventDefault();
        gate.classList.add('dragover');
    });
    gate.addEventListener('dragleave', () => {
        gate.classList.remove('dragover');
    });
    gate.addEventListener('drop', (e) => {
        e.preventDefault();
        gate.classList.remove('dragover');
        // If a circuit component is being dragged here, delete it
        if (trashTarget) {
            if (trashTarget.type === 'gate') {
                circuit[trashTarget.row][trashTarget.col] = null;
                gateHistory = gateHistory.filter(g => g.desc !== trashTarget.historyDesc);
            } else if (trashTarget.type === 'cnot') {
                cnotGates = cnotGates.filter(c => !(c.control[0] === trashTarget.control[0] && c.control[1] === trashTarget.control[1] && c.target[0] === trashTarget.target[0] && c.target[1] === trashTarget.target[1]));
                gateHistory = gateHistory.filter(g => g.desc !== trashTarget.historyDesc);
            } else if (trashTarget.type === 'dcnot') {
                dcnotGates = dcnotGates.filter(dc => !(dc.controls[0][0] === trashTarget.controls[0][0] && dc.controls[0][1] === trashTarget.controls[0][1] && dc.controls[1][0] === trashTarget.controls[1][0] && dc.controls[1][1] === trashTarget.controls[1][1] && dc.target[0] === trashTarget.target[0] && dc.target[1] === trashTarget.target[1]));
                gateHistory = gateHistory.filter(g => g.desc !== trashTarget.historyDesc);
            } else if (trashTarget.type === 'measurement') {
                measurements = measurements.filter(m => !(m.row === trashTarget.row && m.col === trashTarget.col));
                gateHistory = gateHistory.filter(g => g.desc !== trashTarget.historyDesc);
            }
            trashTarget = null;
            movingCnot = null;
            movingCnotOrigin = null;
            movingDcnot = null;
            movingDcnotOrigin = null;
            movingMeasurement = null;
            movingMeasurementOrigin = null;
            renderCircuitAndCnotDrags();
            renderGateHistory();
        }
    });
});

// Add/delete line
addLineBtn.addEventListener('click', () => {
    numLines++;
    circuit.push(Array(numCols).fill(null));
    renderCircuitAndCnotDrags();
});

function updateGateHistoryFromCircuit() {
    gateHistory = [];
    // Single-qubit gates
    for (let i = 0; i < circuit.length; i++) {
        for (let j = 0; j < circuit[i].length; j++) {
            if (circuit[i][j]) {
                gateHistory.push({ desc: `${circuit[i][j].type}(q${i+1})@${j+1}` });
            }
        }
    }
    // CNOTs
    cnotGates.forEach(c => {
        gateHistory.push({ desc: `CNOT(q${c.control[0]+1},q${c.target[0]+1})@${c.control[1]+1}` });
    });
    // DCNOTs
    dcnotGates.forEach(dc => {
        gateHistory.push({ desc: `DCNOT(q[${dc.controls[0][0]}],q[${dc.controls[1][0]}],q[${dc.target[0]}])@${dc.target[1]}` });
    });
    // Measurements
    measurements.forEach(m => {
        gateHistory.push({ desc: `M(q[${m.row}])->c[${m.bit}]@${m.col}` });
    });
}

deleteLineBtn.addEventListener('click', () => {
    if (numLines > 1) {
        numLines--;
        circuit.pop();
        cnotGates = cnotGates.filter(c => c.control[0] < numLines && c.target[0] < numLines);
        dcnotGates = dcnotGates.filter(dc => dc.controls[0][0] < numLines && dc.controls[1][0] < numLines && dc.target[0] < numLines);
        measurements = measurements.filter(m => m.row < numLines);
        updateGateHistoryFromCircuit();
        renderCircuitAndCnotDrags();
        renderGateHistory();
    }
});

addSlotBtn.addEventListener('click', () => {
    numCols++;
    for (let i = 0; i < circuit.length; i++) {
        circuit[i].push(null);
    }
    renderCircuitAndCnotDrags();
    renderGateHistory();
});

deleteSlotBtn.addEventListener('click', () => {
    if (numCols > 1) {
        numCols--;
        for (let i = 0; i < circuit.length; i++) {
            circuit[i].pop();
        }
        cnotGates = cnotGates.filter(c => c.control[1] < numCols && c.target[1] < numCols);
        dcnotGates = dcnotGates.filter(dc => dc.controls[0][1] < numCols && dc.controls[1][1] < numCols && dc.target[1] < numCols);
        measurements = measurements.filter(m => m.col < numCols);
        updateGateHistoryFromCircuit();
        renderCircuitAndCnotDrags();
        renderGateHistory();
    }
});

// Reset button
resetBtn.addEventListener('click', () => {
    circuit = Array.from({ length: numLines }, () => Array(numCols).fill(null));
    cnotGates = [];
    dcnotGates = [];
    measurements = [];
    gateHistory = [];
    renderCircuitAndCnotDrags();
    renderGateHistory();
});

enableTrashcan();

// Initial render
renderCircuitAndCnotDrags();
renderGateHistory();

function getNextClassicalBit(col) {
    let used = measurements.filter(m => m.col === col).map(m => m.bit);
    let bit = 0;
    while (used.includes(bit)) bit++;
    return bit;
}

function sendChatMessage() {
    const msg = chatInput.value.trim() ; //+ " " + exportToQiskitCode() rember to add this back in
    if (msg) {
        chatMessages.innerHTML = `<div style='color:#aaa'>${msg}</div>`;
        chatInput.value = '';
        chatInput.disabled = true;
        chatSend.disabled = true;
        chatMessages.innerHTML += `<div style='color:#888'>...</div>`;
        fetch('http://127.0.0.1:5000/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: msg })
        })
        .then(res => res.json())
        .then(data => {
            chatMessages.innerHTML = `<div style='color:#aaa'>${msg}</div><div>${data.reply}</div>`;
        })
        .catch(() => {
            chatMessages.innerHTML = `<div style='color:#aaa'>${msg}</div><div style='color:#e74c3c'>Error: Could not reach backend.</div>`;
        })
        .finally(() => {
            chatInput.disabled = false;
            chatSend.disabled = false;
            chatInput.focus();
        });
    }
}

chatSend.addEventListener('click', sendChatMessage);
chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        sendChatMessage();
    }
});

qiskitRunBtn.addEventListener('click', () => {
    if (typeof loadQiskitCode === 'function') {
        loadQiskitCode(qiskitEditor.value);
    }
});

function loadQiskitCode(qiskitCode) {
    // Reset circuit
    let lines = qiskitCode.split(/;|\n/).map(l => l.trim()).filter(Boolean);
    let maxQ = numLines, maxC = 1;
    // First pass: handle qreg/creg
    lines.forEach(line => {
        if (/^qreg\s+q\[(\d+)\]/.test(line)) {
            maxQ = parseInt(line.match(/^qreg\s+q\[(\d+)\]/)[1]);
        }
        if (/^creg\s+c\[(\d+)\]/.test(line)) {
            maxC = parseInt(line.match(/^creg\s+c\[(\d+)\]/)[1]);
        }
    });
    numLines = maxQ;
    numCols = Math.max(8, lines.length);
    circuit = Array.from({ length: numLines }, () => Array(numCols).fill(null));
    cnotGates = [];
    dcnotGates = [];
    measurements = [];
    gateHistory = [];
    let colPtr = Array(numLines).fill(0); // next open slot for each qubit

    lines.forEach(line => {
        if (/^h\s+q\[(\d+)\]/i.test(line)) {
            let q = parseInt(line.match(/^h\s+q\[(\d+)\]/i)[1]);
            let col = colPtr[q]++;
            circuit[q][col] = { type: 'H' };
        } else if (/^x\s+q\[(\d+)\]/i.test(line)) {
            let q = parseInt(line.match(/^x\s+q\[(\d+)\]/i)[1]);
            let col = colPtr[q]++;
            circuit[q][col] = { type: 'X' };
        } else if (/^y\s+q\[(\d+)\]/i.test(line)) {
            let q = parseInt(line.match(/^y\s+q\[(\d+)\]/i)[1]);
            let col = colPtr[q]++;
            circuit[q][col] = { type: 'Y' };
        } else if (/^z\s+q\[(\d+)\]/i.test(line)) {
            let q = parseInt(line.match(/^z\s+q\[(\d+)\]/i)[1]);
            let col = colPtr[q]++;
            circuit[q][col] = { type: 'Z' };
        } else if (/^cx\s+q\[(\d+)\],\s*q\[(\d+)\]/i.test(line)) {
            let m = line.match(/^cx\s+q\[(\d+)\],\s*q\[(\d+)\]/i);
            let q1 = parseInt(m[1]), q2 = parseInt(m[2]);
            let col = Math.max(colPtr[q1], colPtr[q2]);
            cnotGates.push({ control: [q1, col], target: [q2, col] });
            colPtr[q1] = colPtr[q2] = col + 1;
        } else if (/^ccx\s+q\[(\d+)\],\s*q\[(\d+)\],\s*q\[(\d+)\]/i.test(line)) {
            let m = line.match(/^ccx\s+q\[(\d+)\],\s*q\[(\d+)\],\s*q\[(\d+)\]/i);
            let q0 = parseInt(m[1]), q1 = parseInt(m[2]), q2 = parseInt(m[3]);
            let col = Math.max(colPtr[q0], colPtr[q1], colPtr[q2]);
            dcnotGates.push({ controls: [[q0, col], [q1, col]], target: [q2, col] });
            colPtr[q0] = colPtr[q1] = colPtr[q2] = col + 1;
        } else if (/^measure\s+q\[(\d+)\]\s*->\s*c\[(\d+)\]/i.test(line)) {
            let m = line.match(/^measure\s+q\[(\d+)\]\s*->\s*c\[(\d+)\]/i);
            let q = parseInt(m[1]), c = parseInt(m[2]);
            let col = colPtr[q]++;
            measurements.push({ row: q, col: col, bit: c });
        }
    });

    // Rebuild gate history
    updateGateHistoryFromCircuit();
    renderCircuitAndCnotDrags();
    renderGateHistory();
}

function exportToQiskitCode() {
    let qiskitLines = [];
    // Qubit and classical register declarations
    qiskitLines.push(`qreg q[${numLines}];`);
    // Find the max classical bit index used in measurements
    let maxC = 0;
    measurements.forEach(m => { if (m.bit + 1 > maxC) maxC = m.bit + 1; });
    qiskitLines.push(`creg c[${Math.max(maxC, 1)}];`);

    // Build a list of gate operations by column (slot)
    for (let col = 0; col < numCols; col++) {
        // Single-qubit gates
        for (let row = 0; row < numLines; row++) {
            if (circuit[row][col]) {
                let type = circuit[row][col].type.toLowerCase();
                if (['h', 'x', 'y', 'z'].includes(type)) {
                    qiskitLines.push(`${type} q[${row}];`);
                }
            }
        }
        // CNOTs
        cnotGates.forEach(c => {
            if (c.control[1] === col) {
                qiskitLines.push(`cx q[${c.control[0]}], q[${c.target[0]}];`);
            }
        });
        // DCNOTs (Toffoli/CCX) - if you want to support this, add:
        dcnotGates.forEach(dc => {
            if (dc.target[1] === col) {
                qiskitLines.push(`ccx q[${dc.controls[0][0]}], q[${dc.controls[1][0]}], q[${dc.target[0]}];`);
            }
        });
        // Measurements
        measurements.forEach(m => {
            if (m.col === col) {
                qiskitLines.push(`measure q[${m.row}] -> c[${m.bit}];`);
            }
        });
    }
    return qiskitLines.join('\n');
}