"use strict";

/** @type {import('sequelize-cli').Migration} */
export default {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("manuals", {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      project_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "projects", key: "id" },
        onDelete: "CASCADE",
      },
      file_name: { type: Sequelize.STRING, allowNull: false },
      file_url: { type: Sequelize.TEXT, allowNull: false },
      file_size_mb: { type: Sequelize.FLOAT, defaultValue: 0 },
      type: { type: Sequelize.STRING(10), defaultValue: "manual" },
      uploaded_by: {
        type: Sequelize.INTEGER,
        references: { model: "users", key: "id" },
      },
      createdAt: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal("NOW()"),
      },
      updatedAt: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal("NOW()"),
      },
    });
    await queryInterface.addIndex("manuals", ["project_id"]);
  },
  async down(queryInterface) {
    await queryInterface.dropTable("manuals");
  },
};
