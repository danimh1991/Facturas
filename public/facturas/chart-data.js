export function carryForwardZeros(values) {
  let previous = 0;

  return values.map((value) => {
    const current = Number(value) || 0;
    if (current !== 0) previous = current;
    return current === 0 ? previous : current;
  });
}
