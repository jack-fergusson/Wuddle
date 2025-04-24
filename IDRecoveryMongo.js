import 'dotenv/config'

import mongoose from 'mongoose';

const uri = process.env.MONGODB_URI;
mongoose.connect(uri);

const Schema = mongoose.Schema;

const IdStorageSchema = new Schema({
    RoomIds: [String],
    PlayerIds: [String],
})

const playerSchema = new Schema({
  ID: String,
  DisplayName: String,
  Events: [String],
  BoardState: [Boolean],
  WinCondition: Boolean,
  NumWins: Number,
});

const chatSchema = new Schema({
  PlayerID: String,
  PlayerName: String,
  Text: String,
});

const roomSchema = new Schema ({
  Name: String,
  ID: String,
  Chats: [chatSchema],
  BoardSize: Number,
  Events: [String],
  Players: [playerSchema],
  CreatorID: String,
});

const IdStorage = mongoose.model(
    "IdStorage",
    IdStorageSchema
);

const Room = mongoose.model(
  "Room",
  roomSchema
);

const Player = mongoose.model(
  "Player",
  playerSchema
);

const Chat = mongoose.model(
  "Chat",
  chatSchema
);



async function main() {
    let PlayerIds = [];
    let RoomIds = [];

    await IdStorage.find().exec()
    .then(async function(IDs) {
        // console.log(IDs);
        await Room.find().exec()
        .then(async function(rooms) {
            console.log(rooms.length);
            rooms.forEach(room => {
                // IDs.RoomIds.push(room.ID);
                RoomIds.push(room.ID);
                room.Players.forEach(player => {
                    // IDs.PlayerIds.push(player.ID);
                    PlayerIds.push(player.ID);
                });
                console.log(room.ID);
            });

            console.log(RoomIds.filter((item, index) => RoomIds.indexOf(item) !== index));

            console.log("Before");
            console.log(RoomIds.length);

            RoomIds = [...new Set(RoomIds)];
            PlayerIds = [...new Set(PlayerIds)];

            console.log("After");
            console.log(RoomIds.length);

            await IdStorage.updateOne(
                { ID : "1" },
                {
                    RoomIds : RoomIds,
                    PlayerIds : PlayerIds
                }
            ).exec()
            .then(console.log("Done!"));
        });
    });
}

main();
