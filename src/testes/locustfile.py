from locust import HttpUser, task, TaskSet

class MyUser(TaskSet):

    def on_start(self):
        # Faça alguma inicialização aqui
        pass

    def on_stop(self):
        # Faça alguma limpeza aqui
        pass

    @task()
    def post_translate(self):
        self.client.post("/translate", 
                         name = "criar tradução", 
                         json={
                             "text": "o rato roeu a roupa do rei de roma"
                         })
        
    # @task()
    # def post_review(self):
    #     self.client.post("/review", 
    #                      name = "criar review", 
    #                      json={
    #                         "text": "o rato roeu a roupa do rei de roma",
    #                         "translation": "RATO ROER ROUPA REI ROMA",
    #                         "rating": "bad",
    #                         "review": "RATO ROER ROUPA REI ROMA"
    #                     })


class WebSiteUser(HttpUser):
    tasks = [
        MyUser
    ]