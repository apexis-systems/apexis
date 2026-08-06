import Razorpay from "razorpay";
import dotenv from "dotenv";

dotenv.config();

const key_id = process.env.RAZORPAY_KEY_ID || "rzp_test_dummy";
const key_secret = process.env.RAZORPAY_KEY_SECRET || "dummy_secret";

export const razorpay = new Razorpay({
  key_id,
  key_secret,
});

export const isLiveMode = key_id.startsWith("rzp_live_");
export const RAZORPAY_KEY_ID = key_id;

export default razorpay;
