import Faker from "faker";

export const id: string = "bar";
export function hello(): void {
  console.log(`Hello from ${id}, ${Faker.name.firstName()}`);
}
