"use strict";

/** @type {import('sequelize-cli').Migration} */
export default {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("blogs", {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      title: { type: Sequelize.STRING, allowNull: false },
      excerpt: { type: Sequelize.TEXT, allowNull: false },
      slug: { type: Sequelize.STRING, allowNull: false, unique: true },
      content_blocks: { type: Sequelize.JSONB, defaultValue: [] },
      faqs: { type: Sequelize.JSONB, defaultValue: [] },
      category: { type: Sequelize.STRING, allowNull: true },
      meta_title: { type: Sequelize.STRING, allowNull: true },
      meta_description: { type: Sequelize.TEXT, allowNull: true },
      author_name: { type: Sequelize.STRING, allowNull: false, defaultValue: "APEXIS" },
      author_role: { type: Sequelize.STRING, allowNull: true },
      author_avatar: { type: Sequelize.TEXT, allowNull: true },
      cover_image: { type: Sequelize.TEXT, allowNull: true },
      tags: { type: Sequelize.ARRAY(Sequelize.STRING), defaultValue: [] },
      read_time: { type: Sequelize.STRING, defaultValue: "1 min read" },
      published_at: { type: Sequelize.DATE, allowNull: true },
      status: { 
        type: Sequelize.ENUM("Draft", "Published"), 
        defaultValue: "Draft" 
      },
      created_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "users", key: "id" },
        onDelete: "SET NULL",
      },
      createdAt: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal("NOW()"),
      },
      updatedAt: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal("NOW()"),
      },
      deletedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
    });

    await queryInterface.addIndex("blogs", ["slug"], { unique: true });
    await queryInterface.addIndex("blogs", ["status"]);
    await queryInterface.addIndex("blogs", ["published_at"]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("blogs");
  },
};
