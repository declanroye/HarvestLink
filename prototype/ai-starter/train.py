"""Train a deliberately small synthetic intent model; no farmer data is claimed."""
import json
import platform
import re
import unicodedata
from pathlib import Path

import numpy as np
import sklearn
from sklearn.feature_extraction.text import CountVectorizer
from sklearn.linear_model import LogisticRegression

ROOT = Path(__file__).resolve().parent
MODEL_DIR = ROOT / 'model'
MAX_CHARS = 320


def normalize(text):
    text = unicodedata.normalize('NFKD', text).encode('ascii', 'ignore').decode().lower()
    return re.sub(r'[ \t\n\r\f\v]+', ' ', text).strip()[:MAX_CHARS]


def features(text):
    text = '^' + normalize(text) + '$'
    return [text[i:i+n] for n in range(3, 6) for i in range(len(text)-n+1)]


SEEDS = {
    'offer': [
        'I have tomatoes available to sell', 'My harvest is ready for a buyer',
        'I can supply 120 kg of tomatoes', 'Please list my tomato crop for sale',
        'I have five bags ready tomorrow', 'Find a buyer for my produce',
        'Tenho tomates disponiveis para vender', 'Minha colheita esta pronta para um comprador',
        'Posso fornecer 120 quilos de tomate', 'Quero anunciar minha safra para venda',
        'Tenho cinco sacos prontos para amanha', 'Procure um comprador para minha producao',
    ],
    'compare': [
        'Compare selling here with shared delivery', 'Which selling option leaves more money',
        'Show the transport cost for each option', 'What do I receive after all costs',
        'Calculate the net income for both offers', 'Is the buyer offer better than farmgate',
        'Compare a venda local com a entrega conjunta', 'Qual opcao de venda deixa mais dinheiro',
        'Mostre o custo de transporte de cada opcao', 'Quanto recebo depois de todos os custos',
        'Calcule a receita liquida das duas ofertas', 'A oferta do comprador e melhor que a venda local',
    ],
    'correct': [
        'Change my quantity to 80 kg', 'I gave the wrong collection date',
        'Correct the grade to grade B', 'Update my harvest details please',
        'Actually I have 150 kilos instead', 'The location should be Parika',
        'Mude minha quantidade para 80 quilos', 'Informei a data de coleta errada',
        'Corrija a qualidade para categoria B', 'Atualize os detalhes da minha colheita',
        'Na verdade tenho 150 quilos', 'O local correto e Boa Vista',
    ],
    'cancel': [
        'Cancel my sale request', 'Do not share my harvest with buyers',
        'I already sold those tomatoes', 'Remove my lot from the delivery',
        'Stop the request I have nothing available', 'Withdraw my offer please',
        'Cancele meu pedido de venda', 'Nao compartilhe minha colheita com compradores',
        'Ja vendi esses tomates', 'Retire meu lote da entrega',
        'Pare o pedido nao tenho mais produto disponivel', 'Quero retirar minha oferta',
    ],
    'help': [
        'How do I use this service', 'I need help with the next step',
        'Can I speak to a person', 'Please explain what I should send',
        'I do not understand your question', 'Show me the available commands',
        'Como uso este servico', 'Preciso de ajuda com o proximo passo',
        'Posso falar com uma pessoa', 'Explique o que devo enviar',
        'Nao entendi sua pergunta', 'Mostre os comandos disponiveis',
    ],
    'other': [
        'Who won the football match', 'My roof needs repair',
        'What medicine should I take', 'Tell me a joke',
        'The school bus is late', 'Where is the nearest hotel',
        'Quem ganhou o jogo de futebol', 'Meu telhado precisa de reparo',
        'Qual remedio devo tomar', 'Conte uma piada',
        'O onibus escolar esta atrasado', 'Onde fica o hotel mais proximo',
    ],
}

# These are manually authored synthetic checks, not an independent farmer benchmark.
CHECKS = [
    {'text': 'Got tomatoes ready, can you help find a buyer?', 'expected': 'offer'},
    {'text': 'Minha safra de tomate esta pronta. Quero vender.', 'expected': 'offer'},
    {'text': 'Compare what is left after packing and freight', 'expected': 'compare'},
    {'text': 'Quanto sobra se eu dividir o transporte?', 'expected': 'compare'},
    {'text': 'Make that 80 kilos, not 120', 'expected': 'correct'},
    {'text': 'A coleta mudou para sexta. Corrija a data.', 'expected': 'correct'},
    {'text': 'All my tomatoes have been sold, remove the offer', 'expected': 'cancel'},
    {'text': 'Nao tenho mais tomates. Cancele a oferta.', 'expected': 'cancel'},
    {'text': 'Can someone explain how to start?', 'expected': 'help'},
    {'text': 'Preciso falar com alguem para entender isso.', 'expected': 'help'},
    {'text': 'Give me the football score', 'expected': 'other'},
    {'text': 'Preciso consertar o telhado da escola', 'expected': 'other'},
]


def main():
    rows = [{'text': t, 'intent': label, 'provenance': 'AI-authored synthetic starter'}
            for label, texts in SEEDS.items() for t in texts]
    vectorizer = CountVectorizer(analyzer=features, max_features=4000, binary=True,
                                 dtype=np.float64)
    matrix = vectorizer.fit_transform([r['text'] for r in rows])
    model = LogisticRegression(C=2.0, max_iter=2000, solver='lbfgs', random_state=42)
    model.fit(matrix, [r['intent'] for r in rows])
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    vocabulary = [''] * len(vectorizer.vocabulary_)
    for token, index in vectorizer.vocabulary_.items():
        vocabulary[index] = token
    metadata = {
        'format': 'harvestlink-intent-f32-v1',
        'labels': model.classes_.tolist(),
        'featureCount': len(vocabulary), 'ngrams': [3, 5], 'binaryFeatures': True,
        'maxCharacters': MAX_CHARS,
        'normalization': 'NFKD; discard non-ASCII; lowercase; collapse ASCII whitespace; trim; truncate',
        'intercepts': model.intercept_.tolist(),
        'weightsLayout': 'little-endian float32, label-major',
        'trainingExamples': len(rows), 'languages': ['en', 'pt-BR'],
        'dataProvenance': 'AI-authored synthetic starter, not farmer messages',
        'clarificationGate': {'minScore': 0.65, 'minMargin': 0.15, 'minMatchedFeatures': 8},
        'warning': 'Scores and gates are uncalibrated. No autonomous transaction is permitted.',
    }
    (MODEL_DIR / 'metadata.json').write_text(json.dumps(metadata, ensure_ascii=False, indent=2))
    (MODEL_DIR / 'vocabulary.json').write_text(json.dumps(vocabulary, ensure_ascii=False,
                                                        separators=(',', ':')))
    model.coef_.astype('<f4').tofile(MODEL_DIR / 'weights.f32')
    (ROOT / 'training_examples.json').write_text(json.dumps(rows, ensure_ascii=False, indent=2))
    test_texts = [r['text'] for r in rows] + [r['text'] for r in CHECKS]
    # Include normalization edge cases in the cross-runtime parity check.
    test_texts += ['  Tenho\tTOMÁTES\npara vender 😃 ', 'ÁãçÊ ê ß İ œ', '', 'a'*600]
    test_matrix = vectorizer.transform(test_texts)
    exported_scores = test_matrix @ model.coef_.astype(np.float32).T + model.intercept_
    reference = [
        {'text': t, 'scores': np.asarray(scores).tolist(), 'pythonPrediction': str(pred)}
        for t, scores, pred in zip(test_texts, exported_scores, model.predict(test_matrix))
    ]
    (ROOT / 'parity_reference.json').write_text(json.dumps(reference, ensure_ascii=False, indent=2))
    check_matrix = vectorizer.transform([r['text'] for r in CHECKS])
    outcomes = [dict(r, prediction=str(p)) for r, p in zip(CHECKS, model.predict(check_matrix))]
    byte_sizes = {p.name: p.stat().st_size for p in sorted(MODEL_DIR.iterdir()) if p.is_file()}
    report = {
        'environment': {'python': platform.python_version(), 'numpy': np.__version__,
                        'scikit_learn': sklearn.__version__},
        'training_examples': len(rows), 'features': len(vocabulary),
        'model_files_bytes': byte_sizes, 'model_pack_bytes': sum(byte_sizes.values()),
        'synthetic_checks_correct': sum(r['expected'] == r['prediction'] for r in outcomes),
        'synthetic_checks_total': len(outcomes), 'synthetic_checks': outcomes,
        'limitations': [
            'Tiny synthetic dataset; checks are authored by the same assistant.',
            'Not independently evaluated on farmer language or regional devices.',
            'Intent classification only; no entity extraction or agricultural advice.',
            'No PWA installation, WhatsApp adapter, SMS adapter or sale engine is provided.',
            'No claim of smartphone speed, memory use or battery performance.',
            'Clarification scores are uncalibrated; human confirmation is required.',
        ],
    }
    (ROOT / 'measurement_report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
    (ROOT / 'requirements.txt').write_text('numpy==' + np.__version__ + '\nscikit-learn==' + sklearn.__version__ + '\n')
    print(json.dumps({k: report[k] for k in ['training_examples', 'features', 'model_files_bytes',
                                          'model_pack_bytes', 'synthetic_checks_correct',
                                          'synthetic_checks_total']}))


if __name__ == '__main__':
    main()
