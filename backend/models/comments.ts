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
        },
        {
            tableName: "comments",
            timestamps: true,
        }
    );

    return Comment;
};
