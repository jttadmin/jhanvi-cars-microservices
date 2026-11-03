import { BookingError } from "../errors/BookingError";
import { FareRuleRepository } from "../repositories/fareRuleRepository";
import {
  FareQuote,
  FareRule,
  RideCategory,
  UpdateFareRuleInput
} from "../types/fareRule";
import { calculateFare } from "./fareCalculator";

const CATEGORY_ORDER: RideCategory[] = [
  "AUTO",
  "ECONOMY",
  "COMFORT",
  "COMFORT_PLUS"
];

export class FareService {
  constructor(private repository: FareRuleRepository) {}

  async getRules(): Promise<FareRule[]> {
    const rules = await this.repository.findAll();
    return rules.sort(
      (a, b) =>
        CATEGORY_ORDER.indexOf(a.vehicleType) -
        CATEGORY_ORDER.indexOf(b.vehicleType)
    );
  }

  async updateRule(
    vehicleType: RideCategory,
    input: UpdateFareRuleInput,
    updatedBy: string | null
  ): Promise<FareRule> {
    const updated = await this.repository.update(
      vehicleType,
      input,
      updatedBy
    );

    if (!updated) {
      throw new BookingError(
        404,
        `No fare rule for ${vehicleType}`,
        "FARE_RULE_NOT_FOUND"
      );
    }

    return updated;
  }

  async quote(
    vehicleType: RideCategory,
    distanceKm: number,
    at: Date
  ): Promise<FareQuote> {
    const rule = await this.repository.findByType(vehicleType);

    if (!rule) {
      throw new BookingError(
        503,
        `Fares for ${vehicleType} are not configured`,
        "FARE_RULE_NOT_FOUND"
      );
    }

    return calculateFare(rule, distanceKm, at);
  }

  async quoteAll(
    distanceKm: number,
    at: Date
  ): Promise<FareQuote[]> {
    const rules = await this.getRules();
    return rules.map((rule) => calculateFare(rule, distanceKm, at));
  }
}
