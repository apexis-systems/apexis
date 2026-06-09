'use strict';

/** @type {import('sequelize-cli').Migration} */
export default {
  async up(queryInterface, Sequelize) {
    // 1. Add 'consultant' and 'vendor' values to the roles ENUM types
    // Using raw SQL because Sequelize doesn't support adding values to PG ENUMs out of the box.
    // Adding VALUE IF NOT EXISTS is safe and avoids duplicate errors.
    await queryInterface.sequelize.query(`
      ALTER TYPE "enum_users_role" ADD VALUE IF NOT EXISTS 'consultant';
    `);
    await queryInterface.sequelize.query(`
      ALTER TYPE "enum_users_role" ADD VALUE IF NOT EXISTS 'vendor';
    `);
    await queryInterface.sequelize.query(`
      ALTER TYPE "enum_project_members_role" ADD VALUE IF NOT EXISTS 'consultant';
    `);
    await queryInterface.sequelize.query(`
      ALTER TYPE "enum_project_members_role" ADD VALUE IF NOT EXISTS 'vendor';
    `);

    // 2. Create the project_member_folders junction table
    await queryInterface.createTable("project_member_folders", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        allowNull: false,
        autoIncrement: true,
      },
      project_member_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "project_members",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      folder_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "folders",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
    });
  },

  async down(queryInterface, Sequelize) {
    // Drop the junction table
    await queryInterface.dropTable("project_member_folders");
    
    // Note: We typically don't remove values from a PG ENUM in a down migration
    // because PostgreSQL doesn't support ALTER TYPE ... REMOVE VALUE.
  }
};
