import type { Sequelize } from "sequelize";
import { DataTypes } from "sequelize";

export default (sequelize: Sequelize) => {
    const Activity = sequelize.define(
        "activities",
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                allowNull: false,
                autoIncrement: true,
            },
            project_id: {
                type: DataTypes.INTEGER,
                allowNull: true,
            },
            user_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
            },
            type: {
                type: DataTypes.ENUM("upload", "edit", "delete", "share", "upload_photo", "uploaded", "comment"),
                allowNull: false,
            },

            description: {
                type: DataTypes.STRING,
                allowNull: false,
            },
        },
        {
            tableName: "activities",
            timestamps: true,
        }
    );

    return Activity;
};
