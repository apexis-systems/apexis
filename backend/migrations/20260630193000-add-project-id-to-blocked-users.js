'use strict';

export default {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("blocked_users", "project_id", {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: "projects",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE"
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("blocked_users", "project_id");
  }
};
