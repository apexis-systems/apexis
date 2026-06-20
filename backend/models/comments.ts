import type { Sequelize } from "sequelize";
import { DataTypes } from "sequelize";

export default (sequelize: Sequelize) => {
    const Comment = sequelize.define(
        "comments",
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                allowNull: false,
                autoIncrement: true,
            },
            file_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
            },
            user_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
            },
            text: {
                type: DataTypes.TEXT,
                allowNull: false,
            },
            parent_id: {
                type: DataTypes.INTEGER,
                allowNull: true,
            },
            is_deleted: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: false,
            },
            deleted_at: {
                type: DataTypes.DATE,
                allowNull: true,
            },
            is_edited: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: false,
            },
            edited_at: {
                type: DataTypes.DATE,
                allowNull: true,
            },
            edit_history: {
                type: DataTypes.JSONB,
                allowNull: false,
                defaultValue: [],
            },
        },
        {
            tableName: "comments",
            timestamps: true,
        }
    );

    return Comment;
};
