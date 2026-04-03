import type { Sequelize } from "sequelize";
import { DataTypes } from "sequelize";

export default (sequelize: Sequelize) => {
    const Manual = sequelize.define(
        "manuals",
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                allowNull: false,
                autoIncrement: true,
            },
            project_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
            },
            file_name: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            file_url: {
                type: DataTypes.TEXT,
                allowNull: false,
            },
            file_size_mb: {
                type: DataTypes.FLOAT,
                allowNull: false,
                defaultValue: 0,
            },
            type: {
                type: DataTypes.STRING(10),
                allowNull: false,
                defaultValue: "manual",
            },
            uploaded_by: {
                type: DataTypes.INTEGER,
                allowNull: true,
            },
        },
        {
            tableName: "manuals",
            timestamps: true,
        }
    );

    return Manual;
};
