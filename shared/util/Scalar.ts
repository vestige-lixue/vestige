import { type tags } from "typia";

// The upper bound excludes Infinity as well as retaining every finite non-negative number.
export type NonNegativeNumber = number & tags.Minimum<0> & tags.Maximum<1.7976931348623157e308>;
export type NonNegativeInteger = number & tags.Type<"uint64"> & tags.Maximum<9007199254740991>;
export type Probability = number & tags.Minimum<0> & tags.Maximum<1>;
export type DateMilliseconds = number & tags.Type<"uint64"> & tags.Maximum<8640000000000000>;