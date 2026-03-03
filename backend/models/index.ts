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
const filesInDir = fs.readdirSync(currentDir).filter((file) => {
  return (
    file.indexOf(".") !== 0 &&
    file !== basename &&
    file.slice(-3) === ".ts" &&
    file.indexOf(".test.ts") === -1
  );
});

// 2. Dynamically import each model file and initialize it
for (const file of filesInDir) {
  const modelModule = await import(`./${file}`);
  const model = modelModule.default(sequelize, DataTypes);
  db[model.name] = model;
}

// Plan <-> Organization
db.organizations.belongsTo(db.plans, { foreignKey: 'plan_id' });
db.plans.hasMany(db.organizations, { foreignKey: 'plan_id' });

// Organization <-> User
db.users.belongsTo(db.organizations, { foreignKey: 'organization_id' });
db.organizations.hasMany(db.users, { foreignKey: 'organization_id' });

// Organization <-> Project
db.projects.belongsTo(db.organizations, { foreignKey: 'organization_id' });
db.organizations.hasMany(db.projects, { foreignKey: 'organization_id' });

// User <-> Project (Creator)
db.projects.belongsTo(db.users, { foreignKey: 'created_by' });
db.users.hasMany(db.projects, { foreignKey: 'created_by' });

// Project <-> ProjectMember
db.project_members.belongsTo(db.projects, { foreignKey: 'project_id' });
db.projects.hasMany(db.project_members, { foreignKey: 'project_id' });

// User <-> ProjectMember
db.project_members.belongsTo(db.users, { foreignKey: 'user_id' });
db.users.hasMany(db.project_members, { foreignKey: 'user_id' });

// Project <-> Folder
db.folders.belongsTo(db.projects, { foreignKey: 'project_id' });
db.projects.hasMany(db.folders, { foreignKey: 'project_id' });

// User <-> Folder (Creator)
db.folders.belongsTo(db.users, { foreignKey: 'created_by' });
db.users.hasMany(db.folders, { foreignKey: 'created_by' });

// Folder <-> Folder (Self-referential parent/child)
db.folders.belongsTo(db.folders, { as: 'parent', foreignKey: 'parent_id' });
db.folders.hasMany(db.folders, { as: 'children', foreignKey: 'parent_id' });

// Folder <-> File
db.files.belongsTo(db.folders, { foreignKey: 'folder_id' });
db.folders.hasMany(db.files, { foreignKey: 'folder_id' });

// Project <-> File
db.files.belongsTo(db.projects, { foreignKey: 'project_id' });
db.projects.hasMany(db.files, { foreignKey: 'project_id' });

// User <-> File (Creator)
db.files.belongsTo(db.users, { foreignKey: 'created_by', as: 'creator' });
db.users.hasMany(db.files, { foreignKey: 'created_by' });

// File <-> Comment
db.comments.belongsTo(db.files, { foreignKey: 'file_id' });
db.files.hasMany(db.comments, { foreignKey: 'file_id' });

// User <-> Comment
db.comments.belongsTo(db.users, { foreignKey: 'user_id', as: 'user' });
db.users.hasMany(db.comments, { foreignKey: 'user_id' });

// Comment <-> Comment (threaded replies)
db.comments.belongsTo(db.comments, { as: 'parent', foreignKey: 'parent_id' });
db.comments.hasMany(db.comments, { as: 'replies', foreignKey: 'parent_id' });

// Project <-> Report
db.reports.belongsTo(db.projects, { foreignKey: 'project_id' });
db.projects.hasMany(db.reports, { foreignKey: 'project_id' });

// Project <-> Snag
db.snags.belongsTo(db.projects, { foreignKey: 'project_id' });
db.projects.hasMany(db.snags, { foreignKey: 'project_id' });

// Snag <-> User (assignee + creator)
db.snags.belongsTo(db.users, { foreignKey: 'assigned_to', as: 'assignee' });
db.snags.belongsTo(db.users, { foreignKey: 'created_by', as: 'creator' });

// Project <-> Manual
db.manuals.belongsTo(db.projects, { foreignKey: 'project_id' });
db.projects.hasMany(db.manuals, { foreignKey: 'project_id' });
db.manuals.belongsTo(db.users, { foreignKey: 'uploaded_by', as: 'uploader' });

db.sequelize = sequelize;
db.Sequelize = Sequelize;

// Export individual models for destructuring imports (e.g. import { users } from "../models";)
export const plans = db.plans;
export const organizations = db.organizations;
export const users = db.users;
export const projects = db.projects;
export const project_members = db.project_members;
export const folders = db.folders;
export const files = db.files;
export const comments = db.comments;
export const reports = db.reports;
export const snags = db.snags;
export const manuals = db.manuals;

export { sequelize, Sequelize };
export default db;
