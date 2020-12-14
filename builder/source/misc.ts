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

export function addEntryToObject(obj: any, kv: [string, any]): any {
  const [k, v] = kv;
  obj[k] = v;
  return obj;
}

export function fromEntries(entries: [string, any][]): Record<string, any> {
  return entries.reduceRight(addEntryToObject, {});
}

export function filterObject<T>(obj: T, pred: (kv: [string, any]) => boolean) {
  if (!obj) return obj;
  return fromEntries(Object.entries(obj).filter(pred));
}

export function mapObject<T>(obj: T, transform: (kv: [string, any]) => any) {
  if (!obj) return obj;
  return fromEntries(
    Object.entries(obj).map(([k, v]): [string, any] => [k, transform([k, v])])
  );
}

export async function mapObjectAsync<T>(
  obj: T,
  transform: (kv: [string, any]) => Promise<any>
) {
  if (!obj) return obj;
  return Promise.all(
    Object.entries(obj).map(
      async ([k, v]): Promise<[string, any]> => [k, await transform([k, v])]
    )
  ).then(fromEntries);
}
