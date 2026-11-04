export default {
  meta: { name: "at" },
  rules: {
    "no-throw": {
      meta: {
        type: "problem",
        schema: [],
        messages: {
          useResult: "src/* での直接 throw は禁止です。neverthrow の Result を返してください。",
        },
      },
      create(context) {
        return {
          ThrowStatement(node) {
            context.report({ node, messageId: "useResult" });
          },
        };
      },
    },
  },
};
