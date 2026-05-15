"use strict";

export default {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("files", "deletedAt", {
      type: Sequelize.DATE,
      allowNull: true,
    });

    await queryInterface.addColumn("folders", "deletedAt", {
      type: Sequelize.DATE,
      allowNull: true,
    });

    await queryInterface.addColumn("rfis", "deletedAt", {
      type: Sequelize.DATE,
      allowNull: true,
    });

    await queryInterface.addColumn("snags", "deletedAt", {
      type: Sequelize.DATE,
      allowNull: true,
    });

    await queryInterface.addColumn("manuals", "deletedAt", {
      type: Sequelize.DATE,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("manuals", "deletedAt");
    await queryInterface.removeColumn("snags", "deletedAt");
    await queryInterface.removeColumn("rfis", "deletedAt");
    await queryInterface.removeColumn("folders", "deletedAt");
    await queryInterface.removeColumn("files", "deletedAt");
  },
};
