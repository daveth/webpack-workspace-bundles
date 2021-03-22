import { name } from "./name";

export const id: string = "bar";
export function hello(): void {
  console.log(`Hello from ${id}, ${name()}`);
}
