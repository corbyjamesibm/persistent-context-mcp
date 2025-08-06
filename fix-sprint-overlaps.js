#!/usr/bin/env node

// Script to fix overlapping sprint dates
// Current issue: All sprints end on same day as next sprint starts

const sprintUpdates = [
  // Digital Delivery Team
  { id: 4539, name: "AI for Everyone-PI1:Digital Delivery:Sprint1", start: "2025-01-31", end: "2025-02-13" },
  { id: 4540, name: "AI for Everyone-PI1:Digital Delivery:Sprint2", start: "2025-02-14", end: "2025-02-27" },
  { id: 4541, name: "AI for Everyone-PI1:Digital Delivery:Sprint3", start: "2025-02-28", end: "2025-03-13" },
  { id: 4542, name: "AI for Everyone-PI1:Digital Delivery:Sprint4", start: "2025-03-14", end: "2025-03-27" },
  { id: 4543, name: "AI for Everyone-PI1:Digital Delivery:Sprint5", start: "2025-03-28", end: "2025-04-10" },
  { id: 4544, name: "AI for Everyone-PI1:Digital Delivery:Sprint6", start: "2025-04-11", end: "2025-04-24" },
  
  // Digital Design Team
  { id: 4588, name: "AI for Everyone-PI1:Digital Design Team:Sprint1", start: "2025-01-31", end: "2025-02-13" },
  { id: 4589, name: "AI for Everyone-PI1:Digital Design Team:Sprint2", start: "2025-02-14", end: "2025-02-27" },
  { id: 4590, name: "AI for Everyone-PI1:Digital Design Team:Sprint3", start: "2025-02-28", end: "2025-03-13" },
  { id: 4594, name: "AI for Everyone-PI1:Digital Design Team:Sprint4", start: "2025-03-14", end: "2025-03-27" },
  { id: 4595, name: "AI for Everyone-PI1:Digital Design Team:Sprint5", start: "2025-03-28", end: "2025-04-10" },
  { id: 4596, name: "AI for Everyone-PI1:Digital Design Team:Sprint6", start: "2025-04-11", end: "2025-04-24" },
  
  // Mobile Development Squad
  { id: 4585, name: "AI for Everyone-PI1:Mobile Development Squad:Sprint1", start: "2025-01-31", end: "2025-02-13" },
  { id: 4586, name: "AI for Everyone-PI1:Mobile Development Squad:Sprint2", start: "2025-02-14", end: "2025-02-27" },
  { id: 4587, name: "AI for Everyone-PI1:Mobile Development Squad:Sprint3", start: "2025-02-28", end: "2025-03-13" },
  { id: 4591, name: "AI for Everyone-PI1:Mobile Development Squad:Sprint4", start: "2025-03-14", end: "2025-03-27" },
  { id: 4592, name: "AI for Everyone-PI1:Mobile Development Squad:Sprint5", start: "2025-03-28", end: "2025-04-10" },
  { id: 4593, name: "AI for Everyone-PI1:Mobile Development Squad:Sprint6", start: "2025-04-11", end: "2025-04-24" }
];

console.log("Sprint updates to fix overlaps:");
console.log("================================");
sprintUpdates.forEach(sprint => {
  console.log(`${sprint.name}:`);
  console.log(`  Current: ${sprint.start} to ${sprint.end}`);
  console.log(`  ID: ${sprint.id}`);
});

console.log("\nKey changes:");
console.log("- Sprint 1 ends on Feb 13 (Thursday)");
console.log("- Sprint 2 starts on Feb 14 (Friday) - no overlap");
console.log("- Each sprint is exactly 14 days");
console.log("- No gaps or overlaps between sprints");