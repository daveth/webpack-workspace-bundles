import Faker from "faker";
export function name(): string {
  return Faker.name.firstName();
}
