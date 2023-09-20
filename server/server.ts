require("dotenv").config()
import app from "./app"
const PORT = process.env.PORT

//create server
app.listen(PORT, () => {
    console.log(`Server is started on PORT : ${PORT}`)
})


