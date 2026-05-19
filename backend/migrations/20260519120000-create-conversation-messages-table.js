"use strict";

/** @type {import('sequelize-cli').Migration} */
export default {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("conversation_messages", {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      item_type: {
        type: Sequelize.ENUM("rfi", "snag"),
        allowNull: false,
      },
      item_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      project_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "projects", key: "id" },
        onDelete: "CASCADE",
      },
      sender_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "users", key: "id" },
        onDelete: "CASCADE",
      },
      text: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      attachment_type: {
        type: Sequelize.ENUM("image", "audio"),
        allowNull: true,
      },
      file_url: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      file_name: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      file_type: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      file_size: {
        type: Sequelize.STRING,
        allowNull: true,
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

    await queryInterface.addIndex("conversation_messages", ["item_type", "item_id"]);
    await queryInterface.addIndex("conversation_messages", ["project_id"]);
    await queryInterface.addIndex("conversation_messages", ["sender_id"]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("conversation_messages");
  },
};
