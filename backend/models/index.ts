import fs from "fs";
import path from "path";
import { Sequelize, DataTypes } from "sequelize";
import type { Options } from "sequelize";
import configParams from "../config/config.js";

// Because we are using ES Modules ("type": "module"), 
// we use import.meta.url and import.meta.dirname instead of __dirname.
const basename = path.basename(import.meta.url);
const currentDir = import.meta.dirname;
const env = process.env.NODE_ENV || "development";
const config = (configParams as Record<string, any>)[env];
const db: any = {};

let sequelize: Sequelize;

if (config.use_env_variable) {
  sequelize = new Sequelize(process.env[config.use_env_variable] as string, config as Options);
} else {
  sequelize = new Sequelize(
    config.database,
    config.username,
    config.password,
    config as Options
  );
}

// 1. Read all files in the current models directory
const files = fs.readdirSync(currentDir).filter((file) => {
  return (
    file.indexOf(".") !== 0 &&
    file !== basename &&
    file.slice(-3) === ".ts" &&
    file.indexOf(".test.ts") === -1
  );
});

// 2. Dynamically import each model file and initialize it
for (const file of files) {
  const modelModule = await import(`./${file}`);
  const model = modelModule.default(sequelize, DataTypes);
  db[model.name] = model;
}

// 3. Run associations if they exist
Object.keys(db).forEach((modelName) => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

export { sequelize, Sequelize };
export default db;
