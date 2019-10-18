module.exports = {
  extends: "airbnb-base",
  rules: {
    "no-underscore-dangle": [
      "error",
      {
        "allow": [
          "_id"
        ],
      },
    ],
    "no-console": [
      "error",
      {
        allow: [
          "error"
        ],
      },
    ],
  },
};
