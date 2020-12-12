// Turns two arrays into one array of pairs
export function zip<T, U>(a: T[], b: U[]): [T, U][] {
  return a.map((ai, i) => [ai, b[i]]);
}

// Flattens arrays or tuples (only traverses one level deep)
export function flatten(arg: any[]): any[] {
  const res: any[] = [];

  arg.forEach((v) => {
    if (Array.isArray(v)) res.push(...v);
    else res.push(v);
  });

  return res;
}

export function filterObject<T>(obj: T, pred: (arg: [string, any]) => boolean) {
  if (!obj) return obj;

  const acc: any = {};
  Object.entries(obj)
    .filter(pred)
    .forEach(([name, val]) => {
      acc[name] = val;
    });

  return acc;
}
