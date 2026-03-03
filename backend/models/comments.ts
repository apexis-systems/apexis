import { DataTypes, Model } from 'sequelize';

export default (sequelize: any, dataTypes: typeof DataTypes) => {
    class comments extends Model { }
    comments.init({
        id: { type: dataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        file_id: { type: dataTypes.INTEGER, allowNull: false },
        user_id: { type: dataTypes.INTEGER, allowNull: false },
        text: { type: dataTypes.TEXT, allowNull: false },
        parent_id: { type: dataTypes.INTEGER, allowNull: true },
    }, {
        sequelize,
        modelName: 'comments',
        tableName: 'comments',
    });
    return comments;
};
