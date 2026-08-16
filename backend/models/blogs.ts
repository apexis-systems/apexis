import type { Sequelize } from "sequelize";
import { DataTypes } from "sequelize";

export default (sequelize: Sequelize) => {
    const Blog = sequelize.define(
        "blogs",
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                allowNull: false,
                autoIncrement: true,
            },
            title: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            excerpt: {
                type: DataTypes.TEXT,
                allowNull: false,
            },
            slug: {
                type: DataTypes.STRING,
                allowNull: false,
                unique: true,
            },
            content_blocks: {
                type: DataTypes.JSONB,
                defaultValue: [],
            },
            faqs: {
                type: DataTypes.JSONB,
                defaultValue: [],
            },
            category: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            meta_title: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            meta_description: {
                type: DataTypes.TEXT,
                allowNull: true,
            },
            author_name: {
                type: DataTypes.STRING,
                allowNull: false,
                defaultValue: "APEXIS",
            },
            author_role: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            author_avatar: {
                type: DataTypes.TEXT,
                allowNull: true,
            },
            cover_image: {
                type: DataTypes.TEXT,
                allowNull: true,
            },
            tags: {
                type: DataTypes.ARRAY(DataTypes.STRING),
                defaultValue: [],
            },
            primary_keywords: {
                type: DataTypes.ARRAY(DataTypes.STRING),
                defaultValue: [],
            },
            secondary_keywords: {
                type: DataTypes.ARRAY(DataTypes.STRING),
                defaultValue: [],
            },
            read_time: {
                type: DataTypes.STRING,
                defaultValue: "1 min read",
            },
            published_at: {
                type: DataTypes.DATE,
                allowNull: true,
            },
            status: {
                type: DataTypes.ENUM("Draft", "Published"),
                defaultValue: "Draft",
            },
            created_by: {
                type: DataTypes.INTEGER,
                allowNull: true,
            },
        },
        {
            tableName: "blogs",
            timestamps: true,
            paranoid: true,
        }
    );

    return Blog;
};
