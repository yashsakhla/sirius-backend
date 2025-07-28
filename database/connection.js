import mongoose from "mongoose";


export const connectDB = async () => {
  const mongoURI = 'mongodb+srv://yashsakhla33:siriusmongodb@cluster0.ru33fmm.mongodb.net/sirius-perfumes';


  try {
    await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("✅ MongoDB connected successfully.");
  } catch (err) {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
  }
};