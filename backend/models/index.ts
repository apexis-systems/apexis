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


// Plan <-> Organization
db.Organization.belongsTo(db.Plan, { foreignKey: 'plan_id' });
db.Plan.hasMany(db.Organization, { foreignKey: 'plan_id' });

// Organization <-> User
db.User.belongsTo(db.Organization, { foreignKey: 'organization_id' });
db.Organization.hasMany(db.User, { foreignKey: 'organization_id' });

// Organization <-> Project
db.Project.belongsTo(db.Organization, { foreignKey: 'organization_id' });
db.Organization.hasMany(db.Project, { foreignKey: 'organization_id' });

// User <-> Project (Creator)
db.Project.belongsTo(db.User, { foreignKey: 'created_by' });
db.User.hasMany(db.Project, { foreignKey: 'created_by' });

// Project <-> ProjectMember
db.ProjectMember.belongsTo(db.Project, { foreignKey: 'project_id' });
db.Project.hasMany(db.ProjectMember, { foreignKey: 'project_id' });

// User <-> ProjectMember
db.ProjectMember.belongsTo(db.User, { foreignKey: 'user_id' });
db.User.hasMany(db.ProjectMember, { foreignKey: 'user_id' });

// Project <-> Folder
db.Folder.belongsTo(db.Project, { foreignKey: 'project_id' });
db.Project.hasMany(db.Folder, { foreignKey: 'project_id' });

// User <-> Folder (Creator)
db.Folder.belongsTo(db.User, { foreignKey: 'created_by' });
db.User.hasMany(db.Folder, { foreignKey: 'created_by' });

// Folder <-> Folder (Self-referential parent/child)
db.Folder.belongsTo(db.Folder, { as: 'parent', foreignKey: 'parent_id' });
db.Folder.hasMany(db.Folder, { as: 'children', foreignKey: 'parent_id' });

// Folder <-> File
db.File.belongsTo(db.Folder, { foreignKey: 'folder_id' });
db.Folder.hasMany(db.File, { foreignKey: 'folder_id' });

// User <-> File (Creator)
db.File.belongsTo(db.User, { foreignKey: 'created_by' });
db.User.hasMany(db.File, { foreignKey: 'created_by' });

db.sequelize = sequelize;
db.Sequelize = Sequelize;

export { sequelize, Sequelize };
export default db;
