$(document).ready(function(){
    $('.modal').modal({
        onCloseEnd: subsElement.init
    });
});

var postsElement = new Vue({
    el: '#posts',
    data: {
      posts: [],
      expanded: -1
    },
    methods: {
        toggle: function (i) {
            // `this` inside methods points to the Vue instance
            if (this.expanded === i) {
                this.expanded = -1;
                $('#post_body'+i).slideUp(500);
            } else {
                $('#post_body'+this.expanded).slideUp(500);
                this.expanded = i;
                $('#post_body'+this.expanded).slideDown(500);
            }
        }
      }
})

$.ajax({
    url: "/posts",
    success: function(posts) {
        postsElement.posts = posts.reverse();
    },
    error: function(xhr,status,error) {
        console.log(error);
    }
});

var subsElement = new Vue({
    el: '#login',
    data: {
        email: '',
        password: '',
        error: '',
        subscribing: false,
        success: false
    },
    methods: {
        init: function() {
            this.subscribing = false;
            this.email = '';
            this.password = '';
            this.error = '';
            this.success = false;
        },
        subscribe: function () {
            if (this.subscribing) {
                return;
            }
            if (!this.email || !this.password) {
                this.error = 'Please fill both username and password.'
                return;
            }
            this.error = '';
            this.subscribing = true;
            var _this = this;
            $.ajax({
                url: "/subscribe",
                method: 'POST',
                data: {
                    IITKusername: this.email,
                    IITKpassword: this.password
                },
                success: function() {
                    _this.success = true;
                },
                error: function(xhr) {
                    _this.subscribing = false;
                    if (xhr.status === 403) {
                        _this.error = 'Incorrect username or password.';
                        return;
                    }
                    if (xhr.status === 408) {
                        _this.error = 'IITK server is busy. Please try after sometime.';
                        return;
                    }
                    if (xhr.status === 409) {
                        _this.error = 'You have already subscribed!';
                        return;
                    }
                    _this.error = 'Oops! Some error occured. Please try after sometime.'
                }
            });
        }
      }
})
