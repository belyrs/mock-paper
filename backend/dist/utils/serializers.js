"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.serializeUser = serializeUser;
exports.serializeQuestion = serializeQuestion;
exports.serializePaper = serializePaper;
const public_content_1 = require("./public-content");
function publicText(value) {
    return (0, public_content_1.redactInternalTechnologyReferences)(value);
}
function serializeUser(user) {
    return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
    };
}
function serializeQuestion(question) {
    return {
        id: question.id,
        paperId: question.paperId,
        position: question.position,
        subject: question.subject,
        classLevel: question.classLevel,
        chapter: question.chapter,
        subTopic: question.subTopic,
        targetExams: question.targetExams,
        difficulty: question.difficulty,
        questionType: question.questionType,
        text: publicText(question.text),
        options: question.options.map(publicText),
        correctOption: question.correctOption,
        correctIndex: question.correctIndex,
        conceptTested: publicText(question.conceptTested),
        commonMistake: publicText(question.commonMistake),
        recommendedRemedialAction: publicText(question.recommendedRemedialAction),
        learningOutcome: publicText(question.learningOutcome),
        bloomsTaxonomyLevel: publicText(question.bloomsTaxonomyLevel),
        examRelevance: question.examRelevance,
        sourceReference: question.sourceReference &&
            !(0, public_content_1.containsInternalTechnologyReference)(question.sourceReference)
            ? question.sourceReference
            : null,
        createdAt: question.createdAt,
        updatedAt: question.updatedAt,
    };
}
function serializePaper(paper) {
    return {
        id: paper.id,
        userId: paper.userId,
        title: paper.title,
        exam: paper.exam,
        classLevel: paper.classLevel,
        mode: paper.mode,
        targetExams: paper.targetExams,
        subjectConfigurations: paper.subjectConfigurations,
        questionCount: paper.questionCount,
        status: paper.status,
        createdAt: paper.createdAt,
        updatedAt: paper.updatedAt,
        questions: (paper.questions ?? [])
            .map(serializeQuestion)
            .sort((left, right) => left.position - right.position),
    };
}
//# sourceMappingURL=serializers.js.map