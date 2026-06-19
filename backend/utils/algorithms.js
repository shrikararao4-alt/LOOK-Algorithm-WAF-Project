// Backend Disk Scheduling Algorithms

const DISK_MAX = 199;

function computeFCFS(queue, head) {
  const sequence = [head, ...queue];
  let totalSeek = 0;
  for (let i = 1; i < sequence.length; i++) {
    totalSeek += Math.abs(sequence[i] - sequence[i - 1]);
  }
  return { sequence, totalSeek };
}

function computeSSTF(queue, head) {
  let currentHead = head;
  let remaining = [...new Set(queue)];
  const sequence = [head];
  let totalSeek = 0;

  while (remaining.length > 0) {
    let closestIndex = 0;
    let minDistance = Math.abs(remaining[0] - currentHead);
    for (let i = 1; i < remaining.length; i++) {
      let distance = Math.abs(remaining[i] - currentHead);
      if (distance < minDistance) {
        minDistance = distance;
        closestIndex = i;
      }
    }
    const nextTrack = remaining[closestIndex];
    totalSeek += minDistance;
    sequence.push(nextTrack);
    currentHead = nextTrack;
    remaining.splice(closestIndex, 1);
  }
  return { sequence, totalSeek };
}

function computeSCAN(queue, head, direction, diskMax = DISK_MAX) {
  const sorted = [...new Set(queue)].sort((a, b) => a - b);
  const left = sorted.filter((t) => t < head).reverse();
  const right = sorted.filter((t) => t >= head);

  let sequence = [head];
  let totalSeek = 0;

  if (direction === "right") {
    sequence = [head, ...right];
    if (left.length > 0) {
      if (sequence[sequence.length - 1] !== diskMax) {
        sequence.push(diskMax);
      }
      sequence = [...sequence, ...left];
    }
  } else {
    sequence = [head, ...left];
    if (right.length > 0) {
      if (sequence[sequence.length - 1] !== 0) {
        sequence.push(0);
      }
      sequence = [...sequence, ...right];
    }
  }

  for (let i = 1; i < sequence.length; i++) {
    totalSeek += Math.abs(sequence[i] - sequence[i - 1]);
  }
  return { sequence, totalSeek };
}

function computeCSCAN(queue, head, direction, diskMax = DISK_MAX) {
  const sorted = [...new Set(queue)].sort((a, b) => a - b);
  const left = sorted.filter((t) => t < head);
  const right = sorted.filter((t) => t >= head);

  let sequence = [head];
  let totalSeek = 0;

  if (direction === "right") {
    sequence = [head, ...right];
    if (left.length > 0) {
      if (sequence[sequence.length - 1] !== diskMax) {
        sequence.push(diskMax);
      }
      sequence.push(0);
      sequence = [...sequence, ...left];
    }
  } else {
    sequence = [head, ...left.reverse()];
    if (right.length > 0) {
      if (sequence[sequence.length - 1] !== 0) {
        sequence.push(0);
      }
      sequence.push(diskMax);
      sequence = [...sequence, ...right.reverse()];
    }
  }

  for (let i = 1; i < sequence.length; i++) {
    totalSeek += Math.abs(sequence[i] - sequence[i - 1]);
  }
  return { sequence, totalSeek };
}

function computeLOOK(queue, head, direction) {
  const sorted = [...new Set(queue)].sort((a, b) => a - b);
  const left = sorted.filter((t) => t < head).reverse();
  const right = sorted.filter((t) => t >= head);

  let order = [];
  if (direction === "right") {
    order = [...right, ...left];
  } else {
    order = [...left, ...right];
  }

  const sequence = [head, ...order];
  let totalSeek = 0;
  for (let i = 1; i < sequence.length; i++) {
    totalSeek += Math.abs(sequence[i] - sequence[i - 1]);
  }
  return { sequence, totalSeek, order };
}

function computeCLOOK(queue, head, direction) {
  const sorted = [...new Set(queue)].sort((a, b) => a - b);
  const left = sorted.filter((t) => t < head);
  const right = sorted.filter((t) => t >= head);

  let sequence = [head];
  let totalSeek = 0;

  if (direction === "right") {
    sequence = [head, ...right];
    if (left.length > 0) {
      sequence = [...sequence, ...left];
    }
  } else {
    sequence = [head, ...left.reverse()];
    if (right.length > 0) {
      sequence = [...sequence, ...right.reverse()];
    }
  }

  for (let i = 1; i < sequence.length; i++) {
    totalSeek += Math.abs(sequence[i] - sequence[i - 1]);
  }
  return { sequence, totalSeek };
}

module.exports = {
  computeFCFS,
  computeSSTF,
  computeSCAN,
  computeCSCAN,
  computeLOOK,
  computeCLOOK,
};
