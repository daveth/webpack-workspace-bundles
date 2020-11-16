import * as Foo from "@daveth/foo";
import * as Bar from "@daveth/bar";
import Faker from "faker";

Foo.hello();
Bar.hello();

console.log(Faker.name.firstName());
