import type { Sequelize } from "sequelize";
import { DataTypes } from "sequelize";

export default (sequelize: Sequelize) => {
    const FileLink = sequelize.define(
        "file_links",
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                allowNull: false,
                autoIncrement: true,
            },
            file_id_1: {
                type: DataTypes.INTEGER,
                allowNull: false,
            },
            file_id_2: {
                type: DataTypes.INTEGER,
                allowNull: false,
            }
        },
        {
            tableName: "file_links",
            timestamps: true,
            paranoid: false,
        }
    );

    return FileLink;
};
