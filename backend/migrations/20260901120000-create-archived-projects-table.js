"use strict";

/** @type {import('sequelize-cli').Migration} */
export default {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("archived_projects", {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
      organization_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "organizations", key: "id" },
        onDelete: "CASCADE",
      },
      original_project_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      contributor_code: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      client_code: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      start_date: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      end_date: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      created_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "users", key: "id" },
        onDelete: "SET NULL",
      },
      archived_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "users", key: "id" },
        onDelete: "SET NULL",
      },
      archived_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("NOW()"),
      },
      zip_file_url: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      zip_file_size_bytes: {
        type: Sequelize.BIGINT,
        allowNull: true,
        defaultValue: 0,
      },
      stats_summary: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: {},
      },
      snapshot_data: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: {},
      },
      status: {
        type: Sequelize.ENUM("archiving", "archived", "restoring", "failed"),
        allowNull: false,
        defaultValue: "archiving",
      },
      error_message: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("NOW()"),
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("NOW()"),
      },
      deletedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
    });

    await queryInterface.addIndex("archived_projects", ["organization_id"]);
    await queryInterface.addIndex("archived_projects", ["original_project_id"]);
    await queryInterface.addIndex("archived_projects", ["status"]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("archived_projects");
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_archived_projects_status";'
    );
  },
};
