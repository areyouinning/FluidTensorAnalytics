import React, { useState, useEffect } from 'react';
import { Shuffle, Check, Trash2 } from 'lucide-react';

const MathScramble = () => {
  const [numCount, setNumCount] = useState(4);
  const [allowedOps, setAllowedOps] = useState(['+', '-', '*', '/']);
  const [puzzle, setPuzzle] = useState(null);
  const [grid, setGrid] = useState([]);
  const [selectedCell, setSelectedCell] = useState(null);
  const [message, setMessage] = useState('');
  const [isCorrect, setIsCorrect] = useState(false);
  const [draggedElement, setDraggedElement] = useState(null);
  const [draggedFrom, setDraggedFrom] = useState(null);

  const allOperators = ['+', '-', '*', '/', '^'];

  const generatePuzzle = () => {
    setMessage('');
    setIsCorrect(false);
    setSelectedCell(null);
    
    // Generate two equations that share a number at intersection
    const size = numCount;
    
    // Horizontal equation
    const hNumbers = Array.from({ length: size }, () => 
      Math.floor(Math.random() * 20) + 1
    );
    const hOperators = Array.from({ length: size - 1 }, () => 
      allowedOps[Math.floor(Math.random() * allowedOps.length)]
    );
    
    // Vertical equation (shares middle number with horizontal)
    const vNumbers = Array.from({ length: size }, () => 
      Math.floor(Math.random() * 20) + 1
    );
    const vOperators = Array.from({ length: size - 1 }, () => 
      allowedOps[Math.floor(Math.random() * allowedOps.length)]
    );
    
    const intersectIdx = Math.floor(size / 2);
    vNumbers[intersectIdx] = hNumbers[intersectIdx];
    
    // Calculate results
    const hResult = evaluateLeftToRight(buildEquation(hNumbers, hOperators));
    const vResult = evaluateLeftToRight(buildEquation(vNumbers, vOperators));
    
    // Create grid structure
    const gridSize = size * 2 + 1;
    const newGrid = Array(gridSize).fill(null).map(() => 
      Array(gridSize).fill(null).map(() => ({ 
        value: null, 
        isActive: false,
        isIntersection: false 
      }))
    );
    
    // Mark active cells for horizontal equation (row = size)
    for (let i = 0; i < size * 2 + 1; i++) {
      newGrid[size][i].isActive = true;
    }
    
    // Mark active cells for vertical equation (col = size)
    for (let i = 0; i < size * 2 + 1; i++) {
      newGrid[i][size].isActive = true;
    }
    
    // Mark intersection
    newGrid[size][size].isIntersection = true;
    
    // Build solution
    const hEquation = buildEquation(hNumbers, hOperators);
    const vEquation = buildEquation(vNumbers, vOperators);
    
    // Collect all elements for the pool
    const allElements = [
      ...hNumbers,
      ...hOperators,
      ...vNumbers.filter((n, i) => i !== intersectIdx),
      ...vOperators,
      '=', '=',
      hResult,
      vResult
    ];
    
    setPuzzle({
      elements: allElements.sort(() => Math.random() - 0.5),
      horizontal: {
        equation: hEquation,
        result: hResult,
        row: size
      },
      vertical: {
        equation: vEquation,
        result: vResult,
        col: size
      },
      gridSize,
      intersectIdx
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
    
    const [row, col] = selectedCell;
    const newGrid = grid.map(r => r.map(c => ({ ...c })));
    newGrid[row][col].value = element;
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

  const handleDropOnCell = (e, row, col) => {
    e.preventDefault();
    if (!draggedElement || !grid[row][col].isActive) return;

    const newGrid = grid.map(r => r.map(c => ({ ...c })));
    
    // Clear the old cell if dragging from grid
    if (draggedFrom.source === 'grid' && draggedFrom.cellPos) {
      const [oldRow, oldCol] = draggedFrom.cellPos;
      newGrid[oldRow][oldCol].value = null;
    }
    
    // Place in new cell
    newGrid[row][col].value = draggedElement;
    
    setGrid(newGrid);
    setDraggedElement(null);
    setDraggedFrom(null);
    setMessage('');
  };

  const handleDropOnAvailable = (e) => {
    e.preventDefault();
    if (!draggedElement || draggedFrom.source !== 'grid') return;

    const newGrid = grid.map(r => r.map(c => ({ ...c })));
    if (draggedFrom.cellPos) {
      const [oldRow, oldCol] = draggedFrom.cellPos;
      newGrid[oldRow][oldCol].value = null;
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
    
    const [row, col] = selectedCell;
    const newGrid = grid.map(r => r.map(c => ({ ...c })));
    newGrid[row][col].value = null;
    setGrid(newGrid);
    setMessage('');
  };

  const checkSolution = () => {
    if (!puzzle) return;
    
    // Extract horizontal equation
    const hRow = puzzle.horizontal.row;
    const hEquation = [];
    for (let col = 0; col < puzzle.gridSize; col++) {
      if (grid[hRow][col].value !== null) {
        hEquation.push(grid[hRow][col].value);
      }
    }
    
    // Extract vertical equation
    const vCol = puzzle.vertical.col;
    const vEquation = [];
    for (let row = 0; row < puzzle.gridSize; row++) {
      if (grid[row][vCol].value !== null) {
        vEquation.push(grid[row][vCol].value);
      }
    }
    
    // Check if intersection matches
    const intersectValue = grid[hRow][vCol].value;
    
    // Validate both equations
    const hValid = evaluateEquation(hEquation);
    const vValid = evaluateEquation(vEquation);
    
    if (hValid !== null && vValid !== null) {
      setIsCorrect(true);
      setMessage('🎉 Perfect! Both equations are correct!');
    } else if (hValid !== null && vValid === null) {
      setMessage('Horizontal equation works, but vertical doesn\'t!');
    } else if (hValid === null && vValid !== null) {
      setMessage('Vertical equation works, but horizontal doesn\'t!');
    } else {
      setMessage('Neither equation is correct yet. Keep trying!');
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
    
    const usedElements = grid.flat()
      .filter(cell => cell.value !== null)
      .map(cell => cell.value);
    
    return puzzle.elements.filter(el => {
      const usedCount = usedElements.filter(used => used === el).length;
      const totalCount = puzzle.elements.filter(e => e === el).length;
      return usedCount < totalCount;
    });
  };

  useEffect(() => {
    generatePuzzle();
  }, []);

  const availableElements = getAvailableElements();

  return (
    <div className="w-full max-w-4xl mx-auto p-6 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl shadow-lg">
      <h1 className="text-4xl font-bold text-center mb-2 text-indigo-900">
        Math Scramble
      </h1>
      <p className="text-center text-gray-600 mb-6">
        Fill the crossword grid to make valid equations horizontally and vertically
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

      {/* Grid */}
      <div className="bg-white rounded-lg p-6 mb-4 shadow">
        <div className="flex justify-center mb-4">
          <div className="inline-grid gap-1" style={{
            gridTemplateColumns: `repeat(${puzzle?.gridSize || 0}, 50px)`
          }}>
            {grid.map((row, rowIdx) => (
              row.map((cell, colIdx) => (
                <div
                  key={`${rowIdx}-${colIdx}`}
                  onDragOver={cell.isActive ? handleDragOver : null}
                  onDrop={cell.isActive ? (e) => handleDropOnCell(e, rowIdx, colIdx) : null}
                  onClick={() => cell.isActive && setSelectedCell([rowIdx, colIdx])}
                  className={`w-12 h-12 border-2 flex items-center justify-center font-bold text-lg transition-all ${
                    !cell.isActive 
                      ? 'bg-gray-800 border-gray-800 cursor-default' 
                      : selectedCell && selectedCell[0] === rowIdx && selectedCell[1] === colIdx
                      ? 'bg-yellow-200 border-yellow-500'
                      : cell.isIntersection
                      ? 'bg-purple-50 border-indigo-400 hover:bg-purple-100'
                      : 'bg-white border-gray-300 hover:bg-blue-50'
                  }`}
                >
                  {cell.value !== null && (
                    <div
                      draggable
                      onDragStart={(e) => handleDragStart(e, cell.value, 'grid', [rowIdx, colIdx])}
                      onDragEnd={handleDragEnd}
                      className="cursor-move w-full h-full flex items-center justify-center"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {cell.value}
                    </div>
                  )}
                </div>
              ))
            ))}
          </div>
        </div>
        
        {selectedCell && (
          <div className="text-center">
            <button
              onClick={clearCell}
              className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 mx-auto"
            >
              <Trash2 size={16} />
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
          Available Elements (drag to grid, click cell then element, or drag from grid to remove):
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
          <li>Drag elements from "Available" directly onto grid cells</li>
          <li>Or click a cell to select it, then click an element to place</li>
          <li>Drag elements between grid cells to move them</li>
          <li>Drag elements from grid back to "Available" to remove</li>
          <li>Create valid equations both horizontally and vertically</li>
          <li>The purple intersection cell must work for both equations</li>
          <li>Equations evaluate left-to-right (no order of operations)</li>
          <li>^ is the exponent operator (2^3 = 8)</li>
        </ul>
      </div>
    </div>
  );
};

export default MathScramble;
