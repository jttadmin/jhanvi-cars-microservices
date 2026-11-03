import { Knex } from "knex";

const schema = () => process.env.DB_SCHEMA ?? "booking_schema";

export async function up(knex: Knex): Promise<void> {
  const hasOtp = await knex.schema
    .withSchema(schema())
    .hasColumn("bookings", "start_otp");

  if (!hasOtp) {
    await knex.schema
      .withSchema(schema())
      .table("bookings", (table) => {
        // 4-digit code the customer gives the driver to start the ride.
        table.string("start_otp", 4).nullable();
        // Wrong attempts since the code was last issued.
        table.integer("start_otp_attempts").notNullable().defaultTo(0);
      });
  }

  // Give bookings that haven't started yet a code so they can still be started.
  await knex.raw(
    `UPDATE ??.bookings
        SET start_otp = lpad((floor(random() * 10000))::int::text, 4, '0'),
            start_otp_attempts = 0
      WHERE start_otp IS NULL
        AND status IN ('PENDING', 'CONFIRMED')`,
    [schema()]
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema
    .withSchema(schema())
    .table("bookings", (table) => {
      table.dropColumn("start_otp");
      table.dropColumn("start_otp_attempts");
    });
}
