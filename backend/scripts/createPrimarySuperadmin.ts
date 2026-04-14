import "dotenv/config";
import bcrypt from "bcrypt";
import { sequelize, users } from "../models/index.ts";

const DEFAULT_EMAIL = "admin@apexis.in";
const DEFAULT_PASSWORD = "1q2w3e";
const DEFAULT_NAME = "Apexis";

const createPrimarySuperadmin = async () => {
  const email = DEFAULT_EMAIL.toLowerCase().trim();

  try {
    await sequelize.authenticate();

    const existingSuperadminCount = await users.count({
      where: { role: "superadmin" },
    });

    if (existingSuperadminCount > 0) {
      console.log(
        `Skipped: ${existingSuperadminCount} superadmin(s) already exist. This bootstrap runs only for first-time setup.`,
      );
      return;
    }

    const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
    const existingUser = await users.findOne({ where: { email } });

    if (existingUser) {
      await existingUser.update({
        name: existingUser.name || DEFAULT_NAME,
        password: passwordHash,
        role: "superadmin",
        is_primary: true,
        email_verified: true,
        organization_id: null,
      });

      console.log(`Promoted existing user "${email}" to primary superadmin.`);
      return;
    }

    await users.create({
      organization_id: null,
      name: DEFAULT_NAME,
      email,
      password: passwordHash,
      role: "superadmin",
      is_primary: true,
      email_verified: true,
      phone_verified: false,
    });

    console.log(`Created primary superadmin: ${email}`);
    console.log("Please log in and change the default password immediately.");
  } catch (error) {
    console.error("Failed to create primary superadmin:", error);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
};

void createPrimarySuperadmin();
