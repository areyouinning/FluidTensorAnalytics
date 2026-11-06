/* Everything on the site, once. Add a page here and it appears on its shelf and its topics.
   shelf: explore | play | way | tools. thumb: a drawing in thumbs.js. Blurbs say what you get to do. */
window.FTA_CATALOG = [
  { href: '/queens-tiling.html', shelf: 'play', topics: ['math'], thumb: 'tiling', title: 'Can queens make a tiling harder?', blurb: 'A math olympiad problem with one extra rule. Beat 3039 on the 2025 board.', fresh: true },
  { href: '/two-halves.html', shelf: 'play', topics: ['chance', 'math'], thumb: 'halves', title: 'Can you fix both copies at once?', blurb: 'An editor too big to ship whole, two copies to mend, and a dose that costs you cells. Beat 7.32%.', fresh: true },
  { href: '/eight-queens.html', shelf: 'play', topics: ['math', 'remix'], thumb: 'queens', title: 'Can eight queens keep the peace?', blurb: 'Place them so that no two attack. There are 92 ways.' },
  { href: '/impossible-escape.html', shelf: 'play', topics: ['math', 'remix'], thumb: 'coins', title: 'Can one coin flip say where the key is?', blurb: 'A prison puzzle that parity makes possible.' },
  { href: '/connections.html', shelf: 'play', topics: ['math'], thumb: 'numbers', title: 'C0nn3ct10ns', blurb: 'Find four numbers that share a property.' },
  { href: '/math-scramble.html', shelf: 'play', topics: ['math'], thumb: 'scramble', title: 'Math Scramble', blurb: 'Build crossing equations from a pile of pieces.' },
  { href: '/math-scramble-3d.html', shelf: 'play', topics: ['math'], thumb: 'scramble3d', title: 'Math Scramble 3D', blurb: 'The same pieces, with one more dimension to get lost in.' },
  { href: '/pauls-game-garage.html', shelf: 'play', topics: ['kids'], thumb: 'garage', title: "Paul's Game Garage", blurb: 'Fly a rain cloud over Clear Creek and play for raindrops.', kids: true },

  { href: '/tensor-analysis.html', shelf: 'explore', topics: ['tensors'], thumb: 'tensor', title: 'What is a tensor, really?', blurb: 'Build one from three lists, then squeeze 960 numbers into 90.' },
  { href: '/climate-tensor-ops.html', shelf: 'explore', topics: ['tensors', 'water'], thumb: 'cube', title: 'Why is climate data a cube?', blurb: 'Real March 1987 weather, and the shape rules that make the sums easy.' },
  { href: '/ensemble-methods.html', shelf: 'explore', topics: ['tensors', 'water', 'chance'], thumb: 'spaghetti', title: 'Why run a forecast a hundred times?', blurb: 'Nudge a chaotic system and watch one answer turn into many.' },
  { href: '/blowup.html', shelf: 'explore', topics: ['fluids'], thumb: 'vortex', title: 'Can a smooth fluid reach infinite speed?', blurb: 'An open question about the equations of water, with three exact vortices in 3D.' },
  { href: '/navier-stokes-demo.html', shelf: 'explore', topics: ['fluids', 'tensors'], thumb: 'stir', title: 'What happens when you stir?', blurb: 'Drag through a live fluid and see how it spins and stretches.' },
  { href: '/navier-stokes-3d-demo.html', shelf: 'explore', topics: ['fluids'], thumb: 'barrier', title: 'What if you pull the wall between two fluids?', blurb: 'Set two densities, remove the barrier, watch it mix in 3D.' },
  { href: '/optimal-channel-networks.html', shelf: 'explore', topics: ['fluids', 'water'], thumb: 'river', title: 'Why do rivers branch the way they do?', blurb: 'Grow a drainage network by minimizing one number.' },
  { href: '/votes-as-rain.html', shelf: 'explore', topics: ['fluids'], thumb: 'rain', title: 'What if votes fell like rain?', blurb: 'U.S. House votes land on their counties and mix as a fluid.' },
  { href: '/remix-sphere.html', shelf: 'explore', topics: ['chance', 'remix'], thumb: 'sphere', title: 'How do you pick a random point in a ball?', blurb: 'Four methods. Two are wrong, and you can see it from the right angle.' },
  { href: '/remix-parrondo.html', shelf: 'explore', topics: ['chance', 'remix'], thumb: 'stairs', title: 'Can two losing games make a winner?', blurb: 'Watch a crowd of players climb a three-sided stair.' },
  { href: '/remix-camouflage.html', shelf: 'explore', topics: ['remix'], thumb: 'stalk', title: 'How do you sneak up on something watching you?', blurb: 'Stay exactly in front of one tree. Dragonflies do something like it.' },

  { href: '/way-of-water.html', shelf: 'way', topics: ['fluids'], thumb: 'wayWater', title: 'The Way of Water', blurb: 'Why stirring mixes, from one stagnation point to the tangle. Eleven chapters.' },
  { href: '/way-of-seven-symbols.html', shelf: 'way', topics: ['math'], thumb: 'waySeven', title: 'The Way of Seven Symbols', blurb: 'One line of mathematics, taken a symbol at a time. Fourteen chapters.' },
  { href: '/way-of-incompleteness.html', shelf: 'way', topics: ['math'], thumb: 'wayGodel', title: 'The Way of Incompleteness', blurb: "Gödel's theorems, with marks you can play with. Eleven chapters." },
  { href: '/way-of-the-unlost.html', shelf: 'way', topics: [], thumb: 'wayUnlost', title: 'The Way of the Unlost', blurb: 'Does a black hole destroy information? Eleven chapters.' },
  { href: '/way-of-claude.html', shelf: 'way', topics: [], thumb: 'wayClaude', title: 'The Way of Claude', blurb: 'How a language model works, written by one. Eleven chapters.' },

  { href: '/weather-map.html', shelf: 'tools', topics: ['water'], thumb: 'radar', title: 'Weather where you are', blurb: 'Local forecast and live radar.' },
  { href: '/water-resources-dashboard.html', shelf: 'tools', topics: ['water'], thumb: 'snow', title: 'Colorado water, today', blurb: 'Snow, drought, streamflow and reservoirs on one map.' },
  { href: '/peak-finder-v3.html', shelf: 'tools', topics: [], thumb: 'peaks', title: 'Which peak is that?', blurb: 'Point your phone at the Front Range.' },
  { href: '/reservoir-optimization-complete.html', shelf: 'tools', topics: ['water'], thumb: 'pareto', title: 'How much can a reservoir promise?', blurb: 'Trade yield against shortage with four optimizers.' },
  { href: '/reservoir-optimization-moo.html', shelf: 'tools', topics: ['water'], thumb: 'parallel', title: 'What if a reservoir has four goals?', blurb: 'Read the tradeoffs on parallel coordinates.' }
];
window.FTA_TOPICS = { fluids: 'Fluids', tensors: 'Tensors', water: 'Water', chance: 'Chance', math: 'Math', remix: 'DataGenetics remixes' };
