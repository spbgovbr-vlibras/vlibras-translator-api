
// import 

const translator = async function textTranslator(req, res, next) {
  res.status(200).json(req.body.text)
}

export default translator;