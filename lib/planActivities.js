function activePlanEntries(blocks = []) {
  return blocks.map((block, index) => ({ block, index })).filter(({ block }) => block && !block.removed);
}

function removePlanActivity(blocks, index) {
  if (!Number.isInteger(index) || !blocks[index] || blocks[index].removed) throw new Error('This activity is no longer available. Refresh the schedule.');
  return blocks.map((block, blockIndex) => blockIndex === index ? { ...block, removed: true, location_id: null, location_name: null } : block);
}

module.exports = { activePlanEntries, removePlanActivity };
