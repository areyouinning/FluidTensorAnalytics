import React, { useState, useEffect } from 'react';
import { Shuffle, Check, RotateCcw, Eye } from 'lucide-react';

const MathScramble3D = () => {
  const [numCount, setNumCount] = useState(4);
  const [allowedOps, setAllowedOps] = useState(['+', '-', '*', '/']);
  const [puzzle, setPuzzle] = useState(null);
  const [grid, setGrid] = useState([]);
  const [selectedCell, setSelectedCell] = useState(null);
  const [message, setMessage] = useState('');
  const [isCorrect, setIsCorrect] = useState(false);
  const [draggedElement, setDraggedElement] = useState(null);
  const [draggedFrom, setDraggedFrom] = useState(null);
  const [viewAngle, setViewAngle] = useState(0);

  const allOperators = ['+', '-', '*', '/', '^'];

  const generatePuzzle = () => {
    setMessage('');
    setIsCorrect(false);
    setSelectedCell(null);
    
    const size = numCount;
    const centerIdx = Math.floor(size / 2);
    
    // Generate three equations: X-axis, Y-axis, Z-axis
    // All three share the center point
    
    // X-axis equation (horizontal)
    const xNumbers = Array.from({ length: size }, () => 
      Math.floor(Math.random() * 15) + 1
    );
    const xOperators = Array.from({ length: size - 1 }, () => 
      allowedOps[Math.floor(Math.random() * allowedOps.length)]
    );
    
    // Y-axis equation (vertical)
    const yNumbers = Array.from({ length: size }, () => 
      Math.floor(Math.random() * 15) + 1
    );
    const yOperators = Array.from({ length: size - 1 }, () => 
      allowedOps[Math.floor(Math.random() * allowedOps.length)]
    );
    
    // Z-axis equation (depth)
    const zNumbers = Array.from({ length: size }, () => 
      Math.floor(Math.random() * 15) + 1
    );
    const zOperators = Array.from({ length: size - 1 }, () => 
      allowedOps[Math.floor(Math.random() * allowedOps.length)]
    );
    
    // Share the center number across all three axes
    const centerNumber = xNumbers[centerIdx];
    yNumbers[centerIdx] = centerNumber;
    zNumbers[centerIdx] = centerNumber;
    
    // Calculate results
    const xResult = evaluateLeftToRight(buildEquation(xNumbers, xOperators));
    const yResult = evaluateLeftToRight(buildEquation(yNumbers, yOperators));
    const zResult = evaluateLeftToRight(buildEquation(zNumbers, zOperators));
    
    // Create 3D grid structure
    const gridSize = size * 2 + 1;
    const newGrid = Array(gridSize).fill(null).map(() => 
      Array(gridSize).fill(null).map(() => 
        Array(gridSize).fill(null).map(() => ({
          value: null,
          isActive: false,
          axis: null,
          isCenter: false
        }))
      )
    );
    
    const center = size;
    
    // Mark X-axis (row=center, col varies, layer=center)
    for (let col = 0; col < gridSize; col++) {
      newGrid[center][col][center].isActive = true;
      newGrid[center][col][center].axis = 'x';
    }
    
    // Mark Y-axis (row varies, col=center, layer=center)
    for (let row = 0; row < gridSize; row++) {
      newGrid[row][center][center].isActive = true;
      newGrid[row][center][center].axis = 'y';
    }
    
    // Mark Z-axis (row=center, col=center, layer varies)
    for (let layer = 0; layer < gridSize; layer++) {
      newGrid[center][center][layer].isActive = true;
      newGrid[center][center][layer].axis = 'z';
    }
    
    // Mark center intersection
    newGrid[center][center][center].isCenter = true;
    
    // Collect all elements
    const allElements = [
      ...xNumbers,
      ...xOperators,
      ...yNumbers.filter((n, i) => i !== centerIdx),
      ...yOperators,
      ...zNumbers.filter((n, i) => i !== centerIdx),
      ...zOperators,
      '=', '=', '=',
      xResult,
      yResult,
      zResult
    ];
    
    setPuzzle({
      elements: allElements.sort(() => Math.random() - 0.5),
      xAxis: { equation: buildEquation(xNumbers, xOperators), result: xResult },
      yAxis: { equation: buildEquation(yNumbers, yOperators), result: yResult },
      zAxis: { equation: buildEquation(zNumbers, zOperators), result: zResult },
      gridSize,
      center
    });
    
    setGrid(newGrid);
  };

  const buildEquation = (numbers, operators) => {
    const eq = [numbers[0]];
    for (let i = 0; i < operators.length; i++) {
      eq.push(operators[i], numbers[i + 1]);
    }
    return eq;
  };

  const evaluateLeftToRight = (equation) => {
    let result = equation[0];
    for (let i = 1; i < equation.length; i += 2) {
      const op = equation[i];
      const num = equation[i + 1];
      
      switch(op) {
        case '+': result += num; break;
        case '-': result -= num; break;
        case '*': result *= num; break;
        case '/': result = Math.floor(result / num); break;
        case '^': result = Math.pow(result, num); break;
      }
    }
    return result;
  };

  const placeElement = (element) => {
    if (!selectedCell) {
      setMessage('Select a cell first!');
      return;
    }
    
    const [row, col, layer] = selectedCell;
    const newGrid = grid.map(r => r.map(c => c.map(l => ({ ...l }))));
    newGrid[row][col][layer].value = element;
    setGrid(newGrid);
    setSelectedCell(null);
    setMessage('');
  };

  const handleDragStart = (e, element, source, cellPos = null) => {
    setDraggedElement(element);
    setDraggedFrom({ source, cellPos });
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDropOnCell = (e, row, col, layer) => {
    e.preventDefault();
    if (!draggedElement || !grid[row][col][layer].isActive) return;

    const newGrid = grid.map(r => r.map(c => c.map(l => ({ ...l }))));
    
    if (draggedFrom.source === 'grid' && draggedFrom.cellPos) {
      const [oldRow, oldCol, oldLayer] = draggedFrom.cellPos;
      newGrid[oldRow][oldCol][oldLayer].value = null;
    }
    
    newGrid[row][col][layer].value = draggedElement;
    
    setGrid(newGrid);
    setDraggedElement(null);
    setDraggedFrom(null);
    setMessage('');
  };

  const handleDropOnAvailable = (e) => {
    e.preventDefault();
    if (!draggedElement || draggedFrom.source !== 'grid') return;

    const newGrid = grid.map(r => r.map(c => c.map(l => ({ ...l }))));
    if (draggedFrom.cellPos) {
      const [oldRow, oldCol, oldLayer] = draggedFrom.cellPos;
      newGrid[oldRow][oldCol][oldLayer].value = null;
    }
    
    setGrid(newGrid);
    setDraggedElement(null);
    setDraggedFrom(null);
    setMessage('');
  };

  const handleDragEnd = () => {
    setDraggedElement(null);
    setDraggedFrom(null);
  };

  const clearCell = () => {
    if (!selectedCell) return;
    
    const [row, col, layer] = selectedCell;
    const newGrid = grid.map(r => r.map(c => c.map(l => ({ ...l }))));
    newGrid[row][col][layer].value = null;
    setGrid(newGrid);
    setMessage('');
  };

  const checkSolution = () => {
    if (!puzzle) return;
    
    const center = puzzle.center;
    
    // Extract X-axis equation (row=center, layer=center)
    const xEquation = [];
    for (let col = 0; col < puzzle.gridSize; col++) {
      if (grid[center][col][center].value !== null) {
        xEquation.push(grid[center][col][center].value);
      }
    }
    
    // Extract Y-axis equation (col=center, layer=center)
    const yEquation = [];
    for (let row = 0; row < puzzle.gridSize; row++) {
      if (grid[row][center][center].value !== null) {
        yEquation.push(grid[row][center][center].value);
      }
    }
    
    // Extract Z-axis equation (row=center, col=center)
    const zEquation = [];
    for (let layer = 0; layer < puzzle.gridSize; layer++) {
      if (grid[center][center][layer].value !== null) {
        zEquation.push(grid[center][center][layer].value);
      }
    }
    
    const xValid = evaluateEquation(xEquation);
    const yValid = evaluateEquation(yEquation);
    const zValid = evaluateEquation(zEquation);
    
    const validCount = [xValid, yValid, zValid].filter(v => v !== null).length;
    
    if (validCount === 3) {
      setIsCorrect(true);
      setMessage('🎉 Perfect! All three equations are correct!');
    } else if (validCount === 2) {
      setMessage(`Good! ${validCount} equations work. Keep going!`);
    } else if (validCount === 1) {
      setMessage(`${validCount} equation works. Keep trying!`);
    } else {
      setMessage('None of the equations are correct yet. Keep working!');
    }
  };

  const evaluateEquation = (eq) => {
    const equalsIndex = eq.indexOf('=');
    if (equalsIndex === -1) return null;
    
    const leftSide = eq.slice(0, equalsIndex);
    const rightSide = eq.slice(equalsIndex + 1);
    
    if (rightSide.length !== 1 || typeof rightSide[0] !== 'number') {
      return null;
    }
    
    for (let i = 0; i < leftSide.length; i++) {
      if (i % 2 === 0) {
        if (typeof leftSide[i] !== 'number') return null;
      } else {
        if (typeof leftSide[i] !== 'string') return null;
      }
    }
    
    const calculated = evaluateLeftToRight(leftSide);
    return calculated === rightSide[0] ? calculated : null;
  };

  const toggleOperator = (op) => {
    if (allowedOps.includes(op)) {
      if (allowedOps.length > 1) {
        setAllowedOps(allowedOps.filter(o => o !== op));
      }
    } else {
      setAllowedOps([...allowedOps, op]);
    }
  };

  const getAvailableElements = () => {
    if (!puzzle) return [];
    
    const usedElements = grid.flat(2)
      .filter(cell => cell.value !== null)
      .map(cell => cell.value);
    
    return puzzle.elements.filter(el => {
      const usedCount = usedElements.filter(used => used === el).length;
      const totalCount = puzzle.elements.filter(e => e === el).length;
      return usedCount < totalCount;
    });
  };

  const render3DView = () => {
    if (!puzzle) return null;
    
    const center = puzzle.center;
    const views = ['XY', 'XZ', 'YZ'];
    const currentView = views[viewAngle % 3];
    
    let displayGrid = [];
    
    if (currentView === 'XY') {
      // Looking down Z-axis (standard top view)
      displayGrid = grid.map((row, rowIdx) => 
        row.map((col, colIdx) => grid[rowIdx][colIdx][center])
      );
    } else if (currentView === 'XZ') {
      // Looking down Y-axis (front view)
      displayGrid = grid.map((row, rowIdx) => 
        Array(puzzle.gridSize).fill(null).map((_, layerIdx) => grid[rowIdx][center][layerIdx])
      );
    } else if (currentView === 'YZ') {
      // Looking down X-axis (side view)
      displayGrid = grid.map((row, rowIdx) => 
        Array(puzzle.gridSize).fill(null).map((_, layerIdx) => grid[rowIdx][layerIdx][center])
      );
    }
    
    return (
      <div>
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-semibold text-gray-700">
            View: {currentView} Plane
          </span>
          <button
            onClick={() => setViewAngle(viewAngle + 1)}
            className="bg-indigo-500 hover:bg-indigo-600 text-white px-3 py-1 rounded flex items-center gap-1 text-sm"
          >
            <RotateCcw size={14} />
            Rotate View
          </button>
        </div>
        
        <div className="flex justify-center mb-4">
          <div className="inline-grid gap-1" style={{
            gridTemplateColumns: `repeat(${puzzle.gridSize}, 50px)`
          }}>
            {displayGrid.map((row, rowIdx) => (
              row.map((cell, colIdx) => {
                let actualRow, actualCol, actualLayer;
                
                if (currentView === 'XY') {
                  actualRow = rowIdx;
                  actualCol = colIdx;
                  actualLayer = center;
                } else if (currentView === 'XZ') {
                  actualRow = rowIdx;
                  actualCol = center;
                  actualLayer = colIdx;
                } else {
                  actualRow = rowIdx;
                  actualCol = colIdx;
                  actualLayer = center;
                }
                
                return (
                  <div
                    key={`${rowIdx}-${colIdx}`}
                    onDragOver={cell.isActive ? handleDragOver : null}
                    onDrop={cell.isActive ? (e) => handleDropOnCell(e, actualRow, actualCol, actualLayer) : null}
                    onClick={() => cell.isActive && setSelectedCell([actualRow, actualCol, actualLayer])}
                    className={`w-12 h-12 border-2 flex items-center justify-center font-bold text-sm transition-all ${
                      !cell.isActive 
                        ? 'bg-gray-800 border-gray-800 cursor-default' 
                        : selectedCell && selectedCell[0] === actualRow && selectedCell[1] === actualCol && selectedCell[2] === actualLayer
                        ? 'bg-yellow-200 border-yellow-500'
                        : cell.isCenter
                        ? 'bg-purple-100 border-purple-500 hover:bg-purple-200'
                        : cell.axis === 'x'
                        ? 'bg-red-50 border-red-300 hover:bg-red-100'
                        : cell.axis === 'y'
                        ? 'bg-green-50 border-green-300 hover:bg-green-100'
                        : cell.axis === 'z'
                        ? 'bg-blue-50 border-blue-300 hover:bg-blue-100'
                        : 'bg-white border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {cell.value !== null && (
                      <div
                        draggable
                        onDragStart={(e) => handleDragStart(e, cell.value, 'grid', [actualRow, actualCol, actualLayer])}
                        onDragEnd={handleDragEnd}
                        className="cursor-move w-full h-full flex items-center justify-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {cell.value}
                      </div>
                    )}
                  </div>
                );
              })
            ))}
          </div>
        </div>
        
        <div className="text-xs text-gray-600 text-center mb-4">
          <div className="flex justify-center gap-4">
            <span className="flex items-center gap-1">
              <div className="w-3 h-3 bg-red-200 border border-red-400"></div>
              X-axis
            </span>
            <span className="flex items-center gap-1">
              <div className="w-3 h-3 bg-green-200 border border-green-400"></div>
              Y-axis
            </span>
            <span className="flex items-center gap-1">
              <div className="w-3 h-3 bg-blue-200 border border-blue-400"></div>
              Z-axis
            </span>
            <span className="flex items-center gap-1">
              <div className="w-3 h-3 bg-purple-200 border border-purple-500"></div>
              Center
            </span>
          </div>
        </div>
      </div>
    );
  };

  useEffect(() => {
    generatePuzzle();
  }, []);

  const availableElements = getAvailableElements();

  return (
    <div className="w-full max-w-4xl mx-auto p-6 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl shadow-lg">
      <h1 className="text-4xl font-bold text-center mb-2 text-indigo-900">
        Math Scramble 3D
      </h1>
      <p className="text-center text-gray-600 mb-6">
        Fill the 3D grid to make valid equations along X, Y, and Z axes
      </p>

      {/* Settings */}
      <div className="bg-white rounded-lg p-4 mb-6 shadow">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold mb-2 text-gray-700">
              Equation Length: {numCount}
            </label>
            <input
              type="range"
              min="3"
              max="5"
              value={numCount}
              onChange={(e) => setNumCount(parseInt(e.target.value))}
              className="w-full"
            />
          </div>
          
          <div>
            <label className="block text-sm font-semibold mb-2 text-gray-700">
              Allowed Operations:
            </label>
            <div className="flex gap-2">
              {allOperators.map(op => (
                <button
                  key={op}
                  onClick={() => toggleOperator(op)}
                  className={`px-4 py-2 rounded-lg font-bold text-lg transition-colors ${
                    allowedOps.includes(op)
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-200 text-gray-400'
                  }`}
                >
                  {op}
                </button>
              ))}
            </div>
          </div>
        </div>
        
        <button
          onClick={generatePuzzle}
          className="mt-4 w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors"
        >
          <Shuffle size={20} />
          New Puzzle
        </button>
      </div>

      {/* 3D Grid */}
      <div className="bg-white rounded-lg p-6 mb-4 shadow">
        {render3DView()}
        
        {selectedCell && (
          <div className="text-center">
            <button
              onClick={clearCell}
              className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 mx-auto"
            >
              <Check size={16} />
              Clear Selected Cell
            </button>
          </div>
        )}
      </div>

      {/* Available Elements */}
      <div 
        className="bg-white rounded-lg p-6 mb-4 shadow"
        onDragOver={handleDragOver}
        onDrop={handleDropOnAvailable}
      >
        <h2 className="text-sm font-semibold mb-3 text-gray-700">
          Available Elements:
        </h2>
        <div className="flex flex-wrap gap-2">
          {availableElements.map((element, index) => (
            <div
              key={index}
              draggable
              onDragStart={(e) => handleDragStart(e, element, 'available')}
              onDragEnd={handleDragEnd}
              onClick={() => placeElement(element)}
              className="px-4 py-2 bg-gray-100 hover:bg-indigo-100 text-gray-900 font-bold text-xl rounded-lg transition-colors cursor-move"
              title="Drag to grid or click after selecting a cell"
            >
              {element}
            </div>
          ))}
        </div>
      </div>

      {/* Check Button */}
      <button
        onClick={checkSolution}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors"
      >
        <Check size={20} />
        Check Solution
      </button>

      {/* Message */}
      {message && (
        <div className={`mt-4 p-4 rounded-lg text-center font-semibold ${
          isCorrect ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
        }`}>
          {message}
        </div>
      )}

      {/* Instructions */}
      <div className="mt-6 text-sm text-gray-600 bg-white rounded-lg p-4">
        <p className="font-semibold mb-2">How to play:</p>
        <ul className="list-disc list-inside space-y-1">
          <li>Three equations intersect at the purple center cell</li>
          <li>X-axis (red), Y-axis (green), Z-axis (blue) must all be valid</li>
          <li>Click "Rotate View" to see different 2D slices of the 3D puzzle</li>
          <li>Drag elements to cells or click cell then element</li>
          <li>The center number must work for all three equations</li>
          <li>Equations evaluate left-to-right (no order of operations)</li>
          <li>^ is the exponent operator (2^3 = 8)</li>
        </ul>
      </div>
    </div>
  );
};

export default MathScramble3D;
