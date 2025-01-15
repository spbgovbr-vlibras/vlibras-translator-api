export default {
  collectCoverage: true,  // Ativa a coleta de cobertura de código
  collectCoverageFrom: ['src/**/*.{js,jsx}'],  // Arquivos de código fonte que serão analisados para cobertura
  coverageDirectory: 'coverage',  // Onde os relatórios de cobertura serão salvos
  coverageReporters: ['text', 'lcov'],  // Tipos de relatórios de cobertura a serem gerados
  transform: {
    '^.+\\.(js|jsx)$': 'babel-jest',  // Transforma arquivos JS/JSX com babel-jest
  },
  moduleFileExtensions: ['js', 'jsx', 'json', 'node'],  // Reconhece essas extensões
  testEnvironment: 'node',  // Configura o Jest para o ambiente Node.js
};
