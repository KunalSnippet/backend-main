import dotenv from "dotenv";
import connectDb from "./db/index.js";
import app from "./app.js";

dotenv.config({
  path: "./.env",
});

connectDb()
.then(() => {
  app.listen(process.env.PORT || 8000, () => {
    console.log(`Server is running on port ${process.env.PORT}`);
  })
})
.catch((error) => {
  console.log(`Error connecting to database ${error}`);
})









// const app = express();
// (async () => {
//   try{
//     await mongoose.connect(` ${process.env.MONGODB_URI}/${DB_NAME}`);
//     app.on("error", (error) => {
//       console.log(`Errror occured in app ${error}`);
//     })

//     app.listen(process.env.PORT, () => {
//       console.log(`Server is ruunning on the port ${process.env.PORT}`);
//     })
//   }
//   catch(error){
//     consoole.error(`Error occured ${error}`);
//   }
// })()